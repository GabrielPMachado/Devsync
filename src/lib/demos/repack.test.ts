import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { repackStored, ZipTooLargeError } from "./repack";

/** Métodos de compressão de cada entrada, lidos do diretório central. */
function methods(zip: Uint8Array): number[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out: number[] = [];
  for (let i = 0; i + 4 <= zip.length; i++) if (view.getUint32(i, true) === 0x02014b50) out.push(view.getUint16(i + 10, true));
  return out;
}

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

describe("repackStored", () => {
  it("reempacota sem compressão, com os mesmos arquivos", async () => {
    const original = zipSync({ "index.html": strToU8("<h1>oi</h1>".repeat(100)), "assets/app.js": strToU8("app()") }, { level: 9 });
    expect(methods(original)).toContain(8);

    const out = await bytes(await repackStored(new Blob([original as BlobPart])));
    expect(methods(out)).toEqual([0, 0]);
    const files = unzipSync(out);
    expect(strFromU8(files["assets/app.js"]!)).toBe("app()");
    expect(strFromU8(files["index.html"]!)).toBe("<h1>oi</h1>".repeat(100));
  });

  it("arquivo que não abre segue como está (o serviço recusa com o motivo certo)", async () => {
    const lixo = new Blob([new Uint8Array([1, 2, 3])]);
    expect(await repackStored(lixo)).toBe(lixo);
  });

  it("zip que já está sem compressão não muda", async () => {
    const stored = new Blob([zipSync({ "index.html": strToU8("x") }, { level: 0 }) as BlobPart]);
    expect(await repackStored(stored)).toBe(stored);
  });

  it("recusa antes de abrir um zip grande demais descompactado (bomba de zip)", async () => {
    // 61 MB de zeros comprimem para poucos KB.
    const bomb = zipSync({ "index.html": new Uint8Array(61 * 1024 * 1024) }, { level: 9 });
    expect(bomb.length).toBeLessThan(1024 * 1024);
    await expect(repackStored(new Blob([bomb as BlobPart]))).rejects.toBeInstanceOf(ZipTooLargeError);
  });

  it("recusa zip com arquivos demais", async () => {
    const many: Record<string, Uint8Array> = {};
    for (let i = 0; i < 1001; i++) many[`f${i}.js`] = strToU8("x");
    await expect(repackStored(new Blob([zipSync(many, { level: 9 }) as BlobPart]))).rejects.toBeInstanceOf(ZipTooLargeError);
  });
});
