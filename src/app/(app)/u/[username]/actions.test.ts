// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { find: vi.fn(), insert: vi.fn(), remove: vi.fn(), count: vi.fn() };
const supabase = {
  from(table: string) {
    if (table === "follows")
      return {
        select: () => ({ eq: (_c: string, a: string) => ({ eq: (_c2: string, b: string) => ({ maybeSingle: () => db.find(a, b) }) }) }),
        insert: (values: unknown) => db.insert(values),
        delete: () => ({ eq: (_c: string, a: string) => ({ eq: (_c2: string, b: string) => db.remove(a, b) }) }),
      };
    if (table === "profiles") return { select: () => ({ eq: (_c: string, id: string) => ({ single: () => db.count(id) }) }) };
    throw new Error(table);
  },
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
const viewer = { id: "u1", email: null, username: "ana", displayName: "Ana", avatarUrl: null };
const getViewer = vi.fn(async () => viewer as typeof viewer | null);
vi.mock("@/lib/auth/viewer", () => ({ getViewer: () => getViewer() }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { toggleFollow } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue(viewer);
  db.find.mockResolvedValue({ data: null });
  db.insert.mockResolvedValue({ error: null });
  db.remove.mockResolvedValue({ error: null });
  db.count.mockResolvedValue({ data: { followers_count: 7 } });
});

describe("toggleFollow", () => {
  it("segue quem ainda não segue e devolve o contador do banco", async () => {
    await expect(toggleFollow("u2", "/@bruno")).resolves.toEqual({ following: true, followers: 7 });
    expect(db.insert).toHaveBeenCalledWith({ followee_id: "u2" });
    expect(revalidatePath).toHaveBeenCalledWith("/u/bruno");
  });

  it("deixa de seguir quem já segue", async () => {
    db.find.mockResolvedValue({ data: { followee_id: "u2" } });
    await expect(toggleFollow("u2", "/@bruno")).resolves.toEqual({ following: false, followers: 7 });
    expect(db.remove).toHaveBeenCalledWith("u1", "u2");
  });

  it("não segue a si mesmo", async () => {
    await expect(toggleFollow("u1", "/@ana")).rejects.toThrow();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("visitante vai para o login e volta para a página", async () => {
    getViewer.mockResolvedValue(null);
    await expect(toggleFollow("u2", "/@bruno")).rejects.toThrow("REDIRECT /entrar?next=%2F%40bruno");
  });

  it("caminho de volta estranho vira o início", async () => {
    getViewer.mockResolvedValue(null);
    await expect(toggleFollow("u2", "//evil.com")).rejects.toThrow("REDIRECT /entrar?next=%2F");
  });

  it("erro do banco vira exceção", async () => {
    db.insert.mockResolvedValue({ error: { message: "suspenso" } });
    await expect(toggleFollow("u2", "/@bruno")).rejects.toThrow();
  });
});
