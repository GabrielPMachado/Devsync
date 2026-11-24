import { CROP_OUTPUT, sourceRect, type CropKind, type CropView } from "./crop-math";

/**
 * Abre um arquivo de imagem no navegador. Rejeita com "invalid-image" se não for
 * uma imagem legível. A URL (img.src) fica viva para o recorte mostrar a imagem:
 * quem chamou revoga quando terminar.
 */
export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    return img;
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("invalid-image");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render-failed"))), type, quality),
  );
}

/** Desenha o recorte no tamanho final e gera WebP (ou JPEG, se o navegador não gera WebP). */
export async function renderCrop(
  img: HTMLImageElement,
  view: CropView,
  kind: CropKind,
  canvas: HTMLCanvasElement = document.createElement("canvas"),
): Promise<Blob> {
  const out = CROP_OUTPUT[kind];
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("render-failed");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const { sx, sy, sw, sh } = sourceRect(view, { width: img.naturalWidth, height: img.naturalHeight }, out);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
  const webp = await toBlob(canvas, "image/webp", 0.85);
  // Safari antigo ignora o tipo pedido e devolve PNG (pesado demais para o bucket).
  if (webp.type === "image/webp") return webp;
  return toBlob(canvas, "image/jpeg", 0.9);
}
