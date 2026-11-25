// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { cleanOrphanCovers, coverFileName, trustedCoverUrl, uploadCover } from "./covers";

const NOW = Date.parse("2026-11-25T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

function fakeSupabase(files: { name: string; created_at: string }[], covers: (string | null)[]) {
  const remove = vi.fn(async () => ({ error: null }));
  const upload = vi.fn(async () => ({ error: null }));
  const supabase = {
    storage: {
      from: () => ({
        list: async () => ({ data: files, error: null }),
        remove,
        upload,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/project-covers/${path}` } }),
      }),
    },
    from: () => ({ select: () => ({ eq: async () => ({ data: covers.map((cover_url) => ({ cover_url })), error: null }) }) }),
  };
  return { supabase, remove, upload };
}

describe("coverFileName", () => {
  it("pega o nome do arquivo sem o ?v=", () => {
    expect(coverFileName("https://x.supabase.co/storage/v1/object/public/project-covers/u1/cover-5.webp?v=5")).toBe("cover-5.webp");
    expect(coverFileName(null)).toBe("");
  });
});

describe("trustedCoverUrl", () => {
  const SB = "https://abc.supabase.co";
  const good = `${SB}/storage/v1/object/public/project-covers/u1/cover-5.webp?v=5`;
  it("só aceita a pasta do autor no Supabase do próprio site", () => {
    expect(trustedCoverUrl(good, "u1", SB)).toBe(good);
    expect(trustedCoverUrl(good, "u2", SB)).toBeNull();
    expect(trustedCoverUrl(good.replace(SB, "https://evil.tld"), "u1", SB)).toBeNull();
    expect(trustedCoverUrl(`${SB}/storage/v1/object/public/banners/u1/cover-5.webp`, "u1", SB)).toBeNull();
    expect(trustedCoverUrl(`${SB}/storage/v1/object/public/project-covers/u1/../x/cover.webp`, "u1", SB)).toBeNull();
    expect(trustedCoverUrl(null, "u1", SB)).toBeNull();
    expect(trustedCoverUrl(good, "u1", undefined)).toBeNull();
  });
});

describe("uploadCover", () => {
  it("envia para a pasta da pessoa com nome novo e devolve a URL com ?v=", async () => {
    const { supabase, upload } = fakeSupabase([], []);
    const blob = new Blob(["x"], { type: "image/webp" });
    await expect(uploadCover(supabase as never, "u1", blob, 77)).resolves.toBe(
      "https://x.supabase.co/storage/v1/object/public/project-covers/u1/cover-77.webp?v=77",
    );
    expect(upload).toHaveBeenCalledWith("u1/cover-77.webp", blob, expect.objectContaining({ upsert: false, contentType: "image/webp" }));
  });
});

describe("cleanOrphanCovers", () => {
  it("apaga só capas que nenhum projeto usa e que já têm mais de um dia", async () => {
    const { supabase, remove } = fakeSupabase(
      [
        { name: "cover-1.webp", created_at: ago(3000) }, // em uso
        { name: "cover-2.webp", created_at: ago(1500) }, // capa trocada: sobra
        { name: "cover-3.webp", created_at: ago(60) }, // recente (publicação em andamento ou tentando de novo)
      ],
      ["https://x.supabase.co/storage/v1/object/public/project-covers/u1/cover-1.webp?v=1", null],
    );
    await cleanOrphanCovers(supabase as never, "u1", NOW);
    expect(remove).toHaveBeenCalledWith(["u1/cover-2.webp"]);
  });

  it("nada para apagar não chama o Storage", async () => {
    const { supabase, remove } = fakeSupabase([{ name: "cover-1.webp", created_at: ago(3000) }], ["https://x/u1/cover-1.webp?v=1"]);
    await cleanOrphanCovers(supabase as never, "u1", NOW);
    expect(remove).not.toHaveBeenCalled();
  });
});
