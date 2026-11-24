import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { imagePath, preparePendingImages, removeProfileImage, uploadProfileImage } from "./profile-images";

function fakeSupabase(base: string, { uploadError = null, removeError = null }: { uploadError?: unknown; removeError?: unknown } = {}) {
  const upload = vi.fn(async () => ({ data: {}, error: uploadError }));
  const remove = vi.fn(async () => ({ data: [], error: removeError }));
  const from = vi.fn((bucket: string) => ({
    upload,
    remove,
    getPublicUrl: (path: string) => ({ data: { publicUrl: `${base}/storage/v1/object/public/${bucket}/${path}` } }),
  }));
  return { client: { storage: { from } } as unknown as SupabaseClient, upload, remove, from };
}

const webp = new Blob(["a"], { type: "image/webp" });

describe("profile-images", () => {
  it("caminhos fixos por pessoa", () => {
    expect(imagePath("u1", "avatar")).toBe("u1/avatar.webp");
    expect(imagePath("u1", "banner")).toBe("u1/banner.webp");
  });

  it("upload usa caminho fixo, upsert e devolve URL com ?v=", async () => {
    const { client, upload, from } = fakeSupabase("https://x.supabase.co");
    const url = await uploadProfileImage(client, "u1", "banner", webp, 42);
    expect(from).toHaveBeenCalledWith("banners");
    expect(upload).toHaveBeenCalledWith("u1/banner.webp", webp, expect.objectContaining({ upsert: true, contentType: "image/webp" }));
    expect(url).toBe("https://x.supabase.co/storage/v1/object/public/banners/u1/banner.webp?v=42");
  });

  it("JPEG de fallback vai com o contentType real e o mesmo caminho", async () => {
    const { client, upload } = fakeSupabase("https://x.supabase.co");
    await uploadProfileImage(client, "u1", "avatar", new Blob(["a"], { type: "image/jpeg" }), 1);
    expect(upload).toHaveBeenCalledWith("u1/avatar.webp", expect.any(Blob), expect.objectContaining({ contentType: "image/jpeg" }));
  });

  it("erro no upload lança upload-failed", async () => {
    const { client } = fakeSupabase("https://x.supabase.co", { uploadError: { message: "Payload too large" } });
    await expect(uploadProfileImage(client, "u1", "avatar", webp)).rejects.toThrow("upload-failed");
  });

  it("remover apaga o arquivo fixo do bucket certo", async () => {
    const { client, remove, from } = fakeSupabase("https://x.supabase.co");
    await removeProfileImage(client, "u1", "avatar");
    expect(from).toHaveBeenCalledWith("avatars");
    expect(remove).toHaveBeenCalledWith(["u1/avatar.webp"]);
  });

  it("preparePendingImages: keep = ausente, remove = vazio, new = URL enviada", async () => {
    const { client, upload } = fakeSupabase("https://x.supabase.co");
    const fields = await preparePendingImages(client, "u1", {
      avatar: { kind: "new", blob: webp, previewUrl: "blob:1" },
      banner: { kind: "remove" },
    }, 7);
    expect(fields).toEqual({ avatarUrl: "https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar.webp?v=7", bannerUrl: "" });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(await preparePendingImages(client, "u1", { avatar: { kind: "keep" }, banner: { kind: "keep" } })).toEqual({});
  });

  it("preparePendingImages propaga falha de envio", async () => {
    const { client } = fakeSupabase("https://x.supabase.co", { uploadError: { message: "x" } });
    await expect(
      preparePendingImages(client, "u1", { avatar: { kind: "keep" }, banner: { kind: "new", blob: webp, previewUrl: "blob:2" } }),
    ).rejects.toThrow("upload-failed");
  });
});
