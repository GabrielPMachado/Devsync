// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  profileUpdate: vi.fn(),
  profileLookup: vi.fn(),
  tags: vi.fn(),
  follows: vi.fn(),
  upload: vi.fn(),
};

const supabase = {
  from(table: string) {
    if (table === "profiles") {
      return {
        update: (values: unknown) => ({ eq: (_c: string, id: string) => db.profileUpdate(values, id) }),
        select: () => ({
          eq: (_c: string, username: string) => ({ neq: (_c2: string, id: string) => ({ maybeSingle: () => db.profileLookup(username, id) }) }),
        }),
      };
    }
    if (table === "tags") return { select: () => ({ in: (_c: string, slugs: string[]) => db.tags(slugs) }) };
    if (table === "tag_follows") return { upsert: (rows: unknown, opts: unknown) => db.follows(rows, opts) };
    throw new Error(table);
  },
  storage: {
    from: () => ({
      upload: (path: string, file: File, opts: unknown) => db.upload(path, file, opts),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `http://storage/avatars/${path}` } }),
    }),
  },
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
const viewer = { id: "u1", email: "ana@x.dev", username: null, displayName: "Ana", avatarUrl: null };
const getViewer = vi.fn(async () => viewer as typeof viewer | null);
vi.mock("@/lib/auth/viewer", () => ({ getViewer: () => getViewer() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { checkUsername, completeOnboarding } = await import("./actions");

function form(data: { username?: string; displayName?: string; tags?: string[]; avatar?: File }) {
  const f = new FormData();
  if (data.username !== undefined) f.set("username", data.username);
  if (data.displayName !== undefined) f.set("displayName", data.displayName);
  for (const t of data.tags ?? []) f.append("tags", t);
  if (data.avatar) f.set("avatar", data.avatar);
  return f;
}

const ok = { username: "Ana_Dev", displayName: " Ana Souza ", tags: ["react", "nextjs", "typescript"] };

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue(viewer);
  db.profileUpdate.mockResolvedValue({ error: null });
  db.profileLookup.mockResolvedValue({ data: null, error: null });
  db.tags.mockImplementation(async (slugs: string[]) => ({ data: slugs.map((s) => ({ id: `id-${s}`, slug: s })), error: null }));
  db.follows.mockResolvedValue({ error: null });
  db.upload.mockResolvedValue({ error: null });
});

describe("checkUsername", () => {
  it("diz se o @ é inválido sem consultar o banco", async () => {
    expect(await checkUsername("ab")).toBe("short");
    expect(db.profileLookup).not.toHaveBeenCalled();
  });

  it("diz se o @ já é de outra pessoa", async () => {
    db.profileLookup.mockResolvedValue({ data: { id: "u2" }, error: null });
    expect(await checkUsername("@Gabriel")).toBe("taken");
    expect(db.profileLookup).toHaveBeenCalledWith("gabriel", "u1");
  });

  it("diz quando está livre", async () => {
    expect(await checkUsername("gabriel")).toBe("available");
  });
});

describe("completeOnboarding", () => {
  it("manda para /entrar quem não está logado", async () => {
    getViewer.mockResolvedValue(null);
    await expect(completeOnboarding({}, form(ok))).rejects.toThrow("REDIRECT /entrar?next=%2Fboas-vindas");
  });

  it("@ inválido não chama o banco", async () => {
    const res = await completeOnboarding({}, form({ ...ok, username: "ana-dev" }));
    expect(res.errors).toEqual({ username: "chars" });
    expect(db.profileUpdate).not.toHaveBeenCalled();
  });

  it("exige nome e pelo menos 3 tags", async () => {
    const res = await completeOnboarding({}, form({ ...ok, displayName: "  ", tags: ["react", "react", "css"] }));
    expect(res.errors).toEqual({ displayName: "required", tags: "min" });
    expect(db.profileUpdate).not.toHaveBeenCalled();
  });

  it("@ que outra pessoa pegou ao mesmo tempo vira 'já está em uso'", async () => {
    db.profileUpdate.mockResolvedValue({ error: { code: "23505" } });
    const res = await completeOnboarding({}, form(ok));
    expect(res.errors).toEqual({ username: "taken" });
    expect(db.follows).not.toHaveBeenCalled();
  });

  it("salva perfil e tags e vai para o início", async () => {
    await expect(completeOnboarding({}, form(ok))).rejects.toThrow("REDIRECT /");
    expect(db.profileUpdate).toHaveBeenCalledWith({ username: "ana_dev", display_name: "Ana Souza" }, "u1");
    expect(db.follows).toHaveBeenCalledWith(
      [
        { profile_id: "u1", tag_id: "id-react" },
        { profile_id: "u1", tag_id: "id-nextjs" },
        { profile_id: "u1", tag_id: "id-typescript" },
      ],
      { onConflict: "profile_id,tag_id", ignoreDuplicates: true },
    );
  });

  it("envia a foto nova para a pasta da pessoa", async () => {
    const avatar = new File([new Uint8Array(10)], "eu.png", { type: "image/png" });
    await expect(completeOnboarding({}, form({ ...ok, avatar }))).rejects.toThrow("REDIRECT /");
    const [path, , opts] = db.upload.mock.calls[0];
    expect(path).toMatch(/^u1\/avatar-\d+\.png$/);
    // Sem upsert: o Storage exige política de SELECT para upsert, e o nome já é único.
    expect(opts).toEqual({ contentType: "image/png", upsert: false });
    expect(db.profileUpdate.mock.calls[0][0]).toMatchObject({ avatar_url: `http://storage/avatars/${path}` });
  });

  it("recusa foto grande ou de outro tipo", async () => {
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "eu.png", { type: "image/png" });
    expect((await completeOnboarding({}, form({ ...ok, avatar: big }))).errors).toEqual({ avatar: "tooBig" });
    const svg = new File(["<svg/>"], "eu.svg", { type: "image/svg+xml" });
    expect((await completeOnboarding({}, form({ ...ok, avatar: svg }))).errors).toEqual({ avatar: "tooBig" });
    expect(db.upload).not.toHaveBeenCalled();
  });
});
