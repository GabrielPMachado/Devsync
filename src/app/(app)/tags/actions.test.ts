// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { tag: vi.fn(), upsert: vi.fn(), remove: vi.fn() };
const supabase = {
  from(table: string) {
    if (table === "tags") return { select: () => ({ eq: (_c: string, slug: string) => ({ maybeSingle: () => db.tag(slug) }) }) };
    if (table === "tag_follows")
      return {
        upsert: (v: unknown) => db.upsert(v),
        delete: () => ({ eq: () => ({ eq: (_c: string, id: string) => db.remove(id) }) }),
      };
    throw new Error(table);
  },
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
const getViewer = vi.fn();
vi.mock("@/lib/auth/viewer", () => ({ getViewer: () => getViewer() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
const { setTagFollow } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue({ id: "u1" });
  db.tag.mockResolvedValue({ data: { id: "t1" } });
  db.upsert.mockResolvedValue({ error: null });
  db.remove.mockResolvedValue({ error: null });
});

describe("setTagFollow", () => {
  it("acompanha e deixa de acompanhar", async () => {
    await expect(setTagFollow("react", true)).resolves.toEqual({ followed: true });
    expect(db.upsert).toHaveBeenCalledWith({ profile_id: "u1", tag_id: "t1" });
    await expect(setTagFollow("react", false)).resolves.toEqual({ followed: false });
    expect(db.remove).toHaveBeenCalledWith("t1");
  });
  it("recusa slug estranho sem ir ao banco", async () => {
    await expect(setTagFollow("../x", true)).rejects.toThrow();
    expect(db.tag).not.toHaveBeenCalled();
  });
  it("visitante vai para o login", async () => {
    getViewer.mockResolvedValue(null);
    await expect(setTagFollow("react", true)).rejects.toThrow("REDIRECT /entrar?next=%2Ftags%2Freact");
  });
});
