import { describe, expect, test } from "vitest";
import { CROP_OUTPUT, ZOOM_MAX, coverScale, initialView, panBy, sourceRect, zoomTo } from "./crop-math";

const img = { width: 2000, height: 1000 };
const square = { width: 512, height: 512 };

describe("crop-math", () => {
  test("coverScale cobre o quadro", () => expect(coverScale(img, square)).toBeCloseTo(0.512));

  test("sourceRect inicial pega o centro quadrado", () =>
    expect(sourceRect(initialView(img), img, square)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 }));

  test("zoom 2 pega metade, mantendo o centro", () =>
    expect(sourceRect(zoomTo(initialView(img), 2, img, square), img, square)).toEqual({ sx: 750, sy: 250, sw: 500, sh: 500 }));

  test("arrastar para a direita mostra mais da esquerda", () => {
    const v = panBy(zoomTo(initialView(img), 2, img, square), 100, 0, img, square);
    expect(v.x).toBeLessThan(1000);
  });

  test("panBy não deixa o quadro sair da imagem", () => {
    expect(sourceRect(panBy(initialView(img), 99999, 0, img, square), img, square).sx).toBe(0);
    expect(sourceRect(panBy(initialView(img), -99999, 0, img, square), img, square).sx).toBe(1000);
  });

  test("zoom fica entre 1 e ZOOM_MAX", () => {
    expect(zoomTo(initialView(img), 0.2, img, square).zoom).toBe(1);
    expect(zoomTo(initialView(img), 10, img, square).zoom).toBe(ZOOM_MAX);
  });

  test("tirar o zoom perto da borda puxa o centro de volta", () => {
    let v = zoomTo(initialView(img), 4, img, square);
    v = panBy(v, 99999, 99999, img, square);
    v = zoomTo(v, 1, img, square);
    expect(sourceRect(v, img, square)).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 1000 });
  });

  test("imagem menor que a saída ainda cobre o quadro", () => {
    const small = { width: 300, height: 300 };
    expect(sourceRect(initialView(small), small, square)).toEqual({ sx: 0, sy: 0, sw: 300, sh: 300 });
  });

  test("banner 3:1 numa imagem quadrada", () => {
    const sq = { width: 900, height: 900 };
    expect(sourceRect(initialView(sq), sq, CROP_OUTPUT.banner)).toEqual({ sx: 0, sy: 300, sw: 900, sh: 300 });
  });

  test("tamanho do quadro na tela não muda o recorte", () => {
    const v = zoomTo(initialView(img), 2, img, square);
    expect(sourceRect(v, img, { width: 256, height: 256 })).toEqual(sourceRect(v, img, square));
  });
});
