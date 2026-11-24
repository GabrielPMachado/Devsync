import { describe, expect, test, vi } from "vitest";
import { initialView } from "./crop-math";
import { loadImage, renderCrop } from "./render-crop";

function fakeImg(width: number, height: number) {
  return { naturalWidth: width, naturalHeight: height } as HTMLImageElement;
}

function fakeCanvas({ webp }: { webp: boolean }) {
  const ctx = { drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: "low" };
  const calls: [string, number][] = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob: (cb: (b: Blob | null) => void, type: string, quality: number) => {
      calls.push([type, quality]);
      const real = type === "image/webp" && !webp ? "image/png" : type;
      cb(new Blob(["x"], { type: real }));
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx, calls };
}

describe("renderCrop", () => {
  test("desenha no tamanho da foto e pede WebP", async () => {
    const { canvas, ctx, calls } = fakeCanvas({ webp: true });
    const blob = await renderCrop(fakeImg(2000, 1000), initialView({ width: 2000, height: 1000 }), "avatar", canvas);
    expect([canvas.width, canvas.height]).toEqual([512, 512]);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 500, 0, 1000, 1000, 0, 0, 512, 512);
    expect(ctx.imageSmoothingQuality).toBe("high");
    expect(blob.type).toBe("image/webp");
    expect(calls).toEqual([["image/webp", 0.85]]);
  });

  test("sem WebP no navegador cai para JPEG", async () => {
    const { canvas, calls } = fakeCanvas({ webp: false });
    const blob = await renderCrop(fakeImg(900, 900), initialView({ width: 900, height: 900 }), "banner", canvas);
    expect([canvas.width, canvas.height]).toEqual([1500, 500]);
    expect(blob.type).toBe("image/jpeg");
    expect(calls.map((c) => c[0])).toEqual(["image/webp", "image/jpeg"]);
  });
});

describe("loadImage", () => {
  test("imagem que não abre vira invalid-image e a URL é revogada", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    // jsdom não implementa decode(); no navegador ele rejeita quando a imagem não abre.
    Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: () => Promise.reject(new Error("EncodingError")) });
    await expect(loadImage(new Blob(["nada"], { type: "text/plain" }))).rejects.toThrow("invalid-image");
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });
});
