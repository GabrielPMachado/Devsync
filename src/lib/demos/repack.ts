import { unzipSync, zipSync } from "fflate";

/** Mesmos tetos do serviço de demos (workers/demos/src/zip.ts): 60 MB descompactado e uma folga de entradas. */
const MAX_UNCOMPRESSED = 60 * 1024 * 1024;
const MAX_ENTRIES = 1000;

/** O zip passa do limite do serviço de demos: nem vale enviar. */
export class ZipTooLargeError extends Error {
  constructor() {
    super("too_large");
  }
}

type Directory = { entries: number; uncompressed: number; allStored: boolean };

/** Lê o diretório central (fim do arquivo) sem descompactar nada. `null` se não for um zip legível. */
function readDirectory(zip: Uint8Array): Directory | null {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  let uncompressed = 0;
  let allStored = true;
  for (let i = 0; i < count; i++) {
    if (p + 46 > zip.length || view.getUint32(p, true) !== 0x02014b50) return null;
    if (view.getUint16(p + 10, true) !== 0) allStored = false;
    uncompressed += view.getUint32(p + 24, true);
    p += 46 + view.getUint16(p + 28, true) + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  return { entries: count, uncompressed, allStored };
}

/**
 * Reempacota o .zip da demo sem compressão antes do envio. O serviço de demos
 * roda no plano grátis do Cloudflare Workers (10 ms de CPU por pedido): com os
 * arquivos já abertos aqui no navegador, lá ele só recorta e grava, sem inflar.
 * Confere os tamanhos declarados antes de abrir (zip bomba não trava a aba) e
 * lança ZipTooLargeError acima do limite. Se o arquivo não abrir, vai como está
 * e o serviço devolve o motivo da recusa.
 */
export async function repackStored(file: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dir = readDirectory(bytes);
  if (!dir) return file;
  if (dir.entries > MAX_ENTRIES || dir.uncompressed > MAX_UNCOMPRESSED) throw new ZipTooLargeError();
  if (dir.allStored) return file;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
    // O tamanho declarado pode mentir: confere o que saiu de fato.
    const real = Object.values(files).reduce((n, f) => n + f.length, 0);
    if (real > MAX_UNCOMPRESSED) throw new ZipTooLargeError();
  } catch (e) {
    if (e instanceof ZipTooLargeError) throw e;
    return file;
  }
  const out = zipSync(files, { level: 0 });
  return new Blob([out as BlobPart], { type: "application/zip" });
}
