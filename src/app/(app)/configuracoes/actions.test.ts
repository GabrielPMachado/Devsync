// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { list: vi.fn(), remove: vi.fn(), update: vi.fn(), tags: vi.fn(), current: vi.fn(), removeTags: vi.fn(), insertTags: vi.fn() };
const supabase = {
  storage: { from: (bucket: string) => ({ list: (dir: string) => db.list(bucket, dir), remove: (paths: string[]) => db.remove(bucket, paths) }) },
  from(table: string) {
    if (table === "profiles") return { update: (v: unknown) => ({ eq: (_c: string, id: string) => ({ select: () => db.update(v, id) }) }) };
    if (table === "tags") return { select: () => ({ in: (_c: string, slugs: string[]) => db.tags(slugs) }) };
    if (table === "profile_tags")
      return {
        select: () => ({ eq: (_c: string, id: string) => db.current(id) }),
        delete: () => ({ eq: (_c: string, id: string) => ({ in: (_c2: string, ids: string[]) => db.removeTags(id, ids) }) }),
        insert: (rows: unknown) => db.insertTags(rows),
      };
    throw new Error(table);
  },
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
const viewer = { id: "u1", email: null, username: "ana", displayName: "Ana", avatarUrl: null };
const getViewer = vi.fn(async () => viewer as typeof viewer | null);
vi.mock("@/lib/auth/viewer", () => ({ getViewer: () => getViewer() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { saveProfile } = await import("./actions");

function form(o: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
}
const ok = { displayName: "Ana Souza", bio: "Front-end", github: "https://github.com/anasouza", site: "https://ana.dev", tags: ["react", "css", "a11y"] };

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue(viewer);
  db.update.mockResolvedValue({ data: [{ id: "u1" }], error: null });
  db.current.mockResolvedValue({ data: [{ tag_id: "id-react" }, { tag_id: "id-go" }], error: null });
  db.tags.mockImplementation(async (slugs: string[]) => ({ data: slugs.map((s) => ({ id: `id-${s}` })) }));
  db.removeTags.mockResolvedValue({ error: null });
  db.insertTags.mockResolvedValue({ error: null });
  db.remove.mockResolvedValue({ error: null });
  db.list.mockResolvedValue({ data: [{ name: "avatar.webp" }, { name: "avatar-123.png" }], error: null });
});

describe("saveProfile", () => {
  it("grava nome, bio, links e troca só a diferença das tecnologias, depois abre o perfil", async () => {
    await expect(saveProfile({}, form(ok))).rejects.toThrow("REDIRECT /@ana?salvo=1");
    expect(db.update).toHaveBeenCalledWith(
      {
        display_name: "Ana Souza",
        bio: "Front-end",
        headline: null,
        location: null,
        status: null,
        banner_preset: null,
        avatar_frame: null,
        accent: null,
        links: { github: "anasouza", site: "https://ana.dev" },
      },
      "u1",
    );
    expect(db.insertTags).toHaveBeenCalledWith([
      { profile_id: "u1", tag_id: "id-css" },
      { profile_id: "u1", tag_id: "id-a11y" },
    ]);
    expect(db.removeTags).toHaveBeenCalledWith("u1", ["id-go"]);
  });

  it("se a inclusão falhar, não apaga as tecnologias que já existiam", async () => {
    db.insertTags.mockResolvedValue({ error: { message: "x" } });
    await expect(saveProfile({}, form(ok))).resolves.toMatchObject({ error: "unknown" });
    expect(db.removeTags).not.toHaveBeenCalled();
  });

  it("conta suspensa (a RLS não altera nenhuma linha) não mexe nas tecnologias", async () => {
    db.update.mockResolvedValue({ data: [], error: null });
    await expect(saveProfile({}, form(ok))).resolves.toMatchObject({ error: "unknown" });
    expect(db.current).not.toHaveBeenCalled();
    expect(db.insertTags).not.toHaveBeenCalled();
    expect(db.removeTags).not.toHaveBeenCalled();
  });

  it("formulário inválido não grava nada e devolve o que foi digitado", async () => {
    const r = await saveProfile({}, form({ ...ok, site: "javascript:alert(1)" }));
    expect(r.errors).toEqual({ site: "https" });
    expect(r.values?.site).toBe("javascript:alert(1)");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("tag que não existe não grava nada", async () => {
    db.tags.mockResolvedValue({ data: [{ id: "id-react" }, { id: "id-css" }] });
    const r = await saveProfile({}, form(ok));
    expect(r.error).toBe("unknown");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("sem tecnologias limpa a lista", async () => {
    await expect(saveProfile({}, form({ ...ok, tags: [] }))).rejects.toThrow("REDIRECT");
    expect(db.removeTags).toHaveBeenCalledWith("u1", ["id-react", "id-go"]);
    expect(db.insertTags).not.toHaveBeenCalled();
  });

  it("links vazios não ficam guardados", async () => {
    await expect(saveProfile({}, form({ ...ok, github: "", site: "" }))).rejects.toThrow("REDIRECT");
    expect(db.update.mock.calls[0][0].links).toEqual({});
  });

  it("erro do banco avisa sem redirecionar", async () => {
    db.update.mockResolvedValue({ error: { message: "x" } });
    await expect(saveProfile({}, form(ok))).resolves.toMatchObject({ error: "unknown" });
  });

  it("visitante vai para o login", async () => {
    getViewer.mockResolvedValue(null);
    await expect(saveProfile({}, form(ok))).rejects.toThrow("REDIRECT /entrar?next=%2Fconfiguracoes");
  });

  it("grava cargo, localização, status, aparência e os links novos", async () => {
    await expect(
      saveProfile(
        {},
        form({ ...ok, headline: "Dev na Acme", location: "SP", status: "building", bannerPreset: "hex", avatarFrame: "gradiente", accent: "ciano", linkedin: "linkedin.com/in/ana", x: "@ana_x", youtube: "@anacoda" }),
      ),
    ).rejects.toThrow("REDIRECT");
    expect(db.update.mock.calls[0][0]).toMatchObject({
      headline: "Dev na Acme",
      location: "SP",
      status: "building",
      banner_preset: "hex",
      avatar_frame: "gradiente",
      accent: "ciano",
      links: { github: "anasouza", site: "https://ana.dev", linkedin: "ana", x: "ana_x", youtube: "anacoda" },
    });
  });

  it("foto e banner: ausentes não mexem, vazios removem, URL nova grava", async () => {
    await expect(saveProfile({}, form(ok))).rejects.toThrow("REDIRECT");
    expect(db.update.mock.calls[0][0]).not.toHaveProperty("avatar_url");
    expect(db.update.mock.calls[0][0]).not.toHaveProperty("banner_url");
    const url = "https://abc.supabase.co/storage/v1/object/public/banners/u1/banner.webp?v=2";
    await expect(saveProfile({}, form({ ...ok, avatarUrl: "", bannerUrl: url }))).rejects.toThrow("REDIRECT");
    expect(db.update.mock.calls[1][0]).toMatchObject({ avatar_url: null, banner_url: url });
    expect(db.list).toHaveBeenCalledWith("avatars", "u1");
    expect(db.remove).toHaveBeenCalledWith("avatars", ["u1/avatar.webp", "u1/avatar-123.png"]);
    // O banner novo fica; os arquivos antigos da pasta saem.
    expect(db.list).toHaveBeenCalledWith("banners", "u1");
    expect(db.remove).toHaveBeenCalledTimes(2);
  });

  it("imagem nova apaga os arquivos antigos da pasta, menos ela", async () => {
    db.list.mockResolvedValueOnce({ data: [{ name: "avatar-1.webp" }, { name: "avatar-123.png" }, { name: "avatar-9.webp" }] });
    const url = "https://abc.supabase.co/storage/v1/object/public/avatars/u1/avatar-9.webp?v=9";
    await expect(saveProfile({}, form({ ...ok, avatarUrl: url }))).rejects.toThrow("REDIRECT");
    expect(db.remove).toHaveBeenCalledWith("avatars", ["u1/avatar-1.webp", "u1/avatar-123.png"]);
  });

  it("se o perfil não salvar, nada é apagado", async () => {
    db.update.mockResolvedValueOnce({ data: [], error: null });
    const url = "https://abc.supabase.co/storage/v1/object/public/avatars/u1/avatar-9.webp?v=9";
    await expect(saveProfile({}, form({ ...ok, avatarUrl: url }))).resolves.toMatchObject({ error: "unknown" });
    expect(db.remove).not.toHaveBeenCalled();
  });

  it("insígnias exibidas: só grava quando a seção veio no formulário, sem repetir, até 3", async () => {
    await expect(saveProfile({}, form(ok))).rejects.toThrow("REDIRECT");
    expect(db.update.mock.calls[0][0]).not.toHaveProperty("shown_badges");
    await expect(saveProfile({}, form({ ...ok, shownBadgesSet: "1", shown_badges: ["mentor", "mentor", "x", "curious", "popular", "founder"] }))).rejects.toThrow("REDIRECT");
    expect(db.update.mock.calls[1][0]).toMatchObject({ shown_badges: ["mentor", "curious", "popular"] });
    await expect(saveProfile({}, form({ ...ok, shownBadgesSet: "1" }))).rejects.toThrow("REDIRECT");
    expect(db.update.mock.calls[2][0]).toMatchObject({ shown_badges: [] });
  });

  it("insígnia não conquistada ou borda bloqueada: mostra o erro certo", async () => {
    db.update.mockResolvedValueOnce({ data: null, error: { code: "DS004" } });
    expect(await saveProfile({}, form({ ...ok, shownBadgesSet: "1", shown_badges: ["mentor"] }))).toMatchObject({ error: "badges" });
    db.update.mockResolvedValueOnce({ data: null, error: { code: "DS005" } });
    expect(await saveProfile({}, form({ ...ok, avatarFrame: "neon" }))).toMatchObject({ error: "frame" });
  });
});
