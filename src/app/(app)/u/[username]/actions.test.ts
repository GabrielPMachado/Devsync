// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { upsert: vi.fn(), remove: vi.fn(), count: vi.fn() };
const supabase = {
  from(table: string) {
    if (table === "follows")
      return {
        upsert: (values: unknown, opts: unknown) => db.upsert(values, opts),
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

const { setFollow } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue(viewer);
  db.upsert.mockResolvedValue({ error: null });
  db.remove.mockResolvedValue({ error: null });
  db.count.mockResolvedValue({ data: { followers_count: 7 } });
});

describe("setFollow", () => {
  it("segue (sem erro se já seguia) e devolve o contador do banco", async () => {
    await expect(setFollow("u2", true, "/@bruno")).resolves.toEqual({ following: true, followers: 7 });
    expect(db.upsert).toHaveBeenCalledWith({ follower_id: "u1", followee_id: "u2" }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
    expect(db.remove).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/u/bruno");
  });

  it("deixa de seguir", async () => {
    await expect(setFollow("u2", false, "/@bruno")).resolves.toEqual({ following: false, followers: 7 });
    expect(db.remove).toHaveBeenCalledWith("u1", "u2");
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("não segue a si mesmo", async () => {
    await expect(setFollow("u1", true, "/@ana")).rejects.toThrow();
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("visitante vai para o login e volta para a página", async () => {
    getViewer.mockResolvedValue(null);
    await expect(setFollow("u2", true, "/@bruno")).rejects.toThrow("REDIRECT /entrar?next=%2F%40bruno");
  });

  it("caminho de volta estranho vira o início", async () => {
    getViewer.mockResolvedValue(null);
    await expect(setFollow("u2", true, "//evil.com")).rejects.toThrow("REDIRECT /entrar?next=%2F");
  });

  it("erro do banco vira exceção", async () => {
    db.upsert.mockResolvedValue({ error: { message: "suspenso" } });
    await expect(setFollow("u2", true, "/@bruno")).rejects.toThrow();
  });
});
