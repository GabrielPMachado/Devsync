import { unzipSync, zipSync } from "fflate";

function allStored(zip: Uint8Array): boolean {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let entries = 0;
  for (let i = 0; i + 46 <= zip.length; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    entries++;
    if (view.getUint16(i + 10, true) !== 0) return false;
  }
  return entries > 0;
}

/**
 * Reempacota o .zip da demo sem compressão antes do envio. O serviço de demos
 * roda no plano grátis do Cloudflare Workers (10 ms de CPU por pedido): com os
 * arquivos já abertos aqui no navegador, lá ele só recorta e grava, sem inflar.
 * Se o arquivo não abrir, vai como está e o serviço devolve o motivo da recusa.
 */
export async function repackStored(file: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (allStored(bytes)) return file;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return file;
  }
  const out = zipSync(files, { level: 0 });
  return new Blob([out as BlobPart], { type: "application/zip" });
}
