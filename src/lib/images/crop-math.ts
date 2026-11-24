/**
 * Recorte de imagem: contas puras, sem DOM.
 * A vista guarda o zoom (1 = a imagem cobre o quadro na menor escala) e o
 * centro visível em pixels da imagem original. Assim o recorte não depende do
 * tamanho do quadro na tela, só da proporção.
 */

export type Size = { width: number; height: number };
export type CropView = { zoom: number; x: number; y: number };

export const CROP_OUTPUT = {
  avatar: { width: 512, height: 512 },
  banner: { width: 1500, height: 500 },
} as const;
export type CropKind = keyof typeof CROP_OUTPUT;

export const ZOOM_MAX = 4;

export function initialView(img: Size): CropView {
  return { zoom: 1, x: img.width / 2, y: img.height / 2 };
}

/** Menor escala (px do quadro por px da imagem) em que a imagem cobre o quadro inteiro. */
export function coverScale(img: Size, frame: Size): number {
  return Math.max(frame.width / img.width, frame.height / img.height);
}

/** Tamanho, em px da imagem, da área que aparece no quadro. */
function visible(zoom: number, img: Size, frame: Size): Size {
  const scale = coverScale(img, frame) * zoom;
  return { width: frame.width / scale, height: frame.height / scale };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function clampView(view: CropView, img: Size, frame: Size): CropView {
  const zoom = clamp(view.zoom, 1, ZOOM_MAX);
  const v = visible(zoom, img, frame);
  return {
    zoom,
    x: clamp(view.x, v.width / 2, img.width - v.width / 2),
    y: clamp(view.y, v.height / 2, img.height - v.height / 2),
  };
}

/** Arrastar a imagem dx/dy px na tela (quadro de tamanho `frame`). */
export function panBy(view: CropView, dx: number, dy: number, img: Size, frame: Size): CropView {
  const scale = coverScale(img, frame) * view.zoom;
  return clampView({ ...view, x: view.x - dx / scale, y: view.y - dy / scale }, img, frame);
}

export function zoomTo(view: CropView, zoom: number, img: Size, frame: Size): CropView {
  return clampView({ ...view, zoom }, img, frame);
}

/** Retângulo da imagem original que vai para a saída. */
export function sourceRect(view: CropView, img: Size, frame: Size) {
  const v = clampView(view, img, frame);
  const size = visible(v.zoom, img, frame);
  const sx = Math.max(0, Math.round(v.x - size.width / 2));
  const sy = Math.max(0, Math.round(v.y - size.height / 2));
  // Arredondar separado pode passar 1 px da borda; Safari antigo não desenha nada nesse caso.
  return { sx, sy, sw: Math.min(Math.round(size.width), img.width - sx), sh: Math.min(Math.round(size.height), img.height - sy) };
}
