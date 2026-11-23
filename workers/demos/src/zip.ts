import { Inflate } from "fflate";
import { ALLOWED_EXTENSIONS, extensionOf } from "./content-types";

export const LIMITS = {
  maxZipBytes: 25 * 1024 * 1024,
  maxFiles: 500,
  // Tudo cabe na memória do isolate (128 MB) junto com o zip de 25 MB.
  maxTotalBytes: 60 * 1024 * 1024,
} as const;

export type ZipRejection =
  | "too_large"
  | "not_a_zip"
  | "unsupported_zip"
  | "encrypted"
  | "too_many_files"
  | "unsafe_path"
  | "symlink"
  | "extension_not_allowed"
  | "duplicate_path"
  | "no_index"
  | "too_big_uncompressed"
  | "corrupt";

export interface DemoFile {
  path: string;
  data: Uint8Array;
}

export type ZipResult = { ok: true; files: DemoFile[] } | { ok: false; reason: ZipRejection };

/** Arquivo já validado pelo diretório central; `read()` infla e confere o CRC (lança ZipReadError). */
export interface LazyDemoFile {
  path: string;
  read(): Uint8Array;
}

export type OpenedZip = { ok: true; files: LazyDemoFile[] } | { ok: false; reason: ZipRejection };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entry {
  name: string;
  method: number;
  flags: number;
  crc: number;
  csize: number;
  usize: number;
  madeByUnix: boolean;
  mode: number;
  offset: number;
}

export class ZipReadError extends Error {
  constructor(readonly reason: ZipRejection) {
    super(reason);
  }
}

const JUNK = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

function readCentralDirectory(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view);
  if (eocd < 0) throw new ZipReadError("not_a_zip");
  const count = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff || view.getUint16(eocd + 4, true) !== 0) {
    throw new ZipReadError("unsupported_zip");
  }
  // Teto bruto antes de olhar cada entrada (o lixo ignorado também conta aqui).
  if (count > LIMITS.maxFiles * 2) throw new ZipReadError("too_many_files");

  const decoder = new TextDecoder();
  const entries: Entry[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw new ZipReadError("corrupt");
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    if (p + 46 + nameLen > bytes.length) throw new ZipReadError("corrupt");
    const csize = view.getUint32(p + 20, true);
    const usize = view.getUint32(p + 24, true);
    const offset = view.getUint32(p + 42, true);
    if (csize === 0xffffffff || usize === 0xffffffff || offset === 0xffffffff) throw new ZipReadError("unsupported_zip");
    entries.push({
      name: decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      flags: view.getUint16(p + 8, true),
      method: view.getUint16(p + 10, true),
      crc: view.getUint32(p + 16, true),
      csize,
      usize,
      madeByUnix: view.getUint8(p + 5) === 3,
      mode: view.getUint32(p + 38, true) >>> 16,
      offset,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function isUnsafePath(name: string): boolean {
  if (name.length === 0 || name.length > 512) return true;
  if (name.includes("\\") || name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return true;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) return true;
  const segments = name.replace(/\/$/, "").split("/");
  return segments.some((s) => s === "" || s === "." || s === "..");
}

function isJunk(name: string): boolean {
  const segments = name.split("/");
  return segments[0] === "__MACOSX" || JUNK.has(segments[segments.length - 1]!);
}

const CHUNK = 16 * 1024;

/**
 * Infla em pedaços e para assim que a saída passa do tamanho declarado. Um zip
 * bomb que mente o tamanho é recusado depois de poucos pedaços, sem gastar CPU
 * inflando o resto.
 */
function inflateLimited(raw: Uint8Array, declared: number): Uint8Array {
  const out = new Uint8Array(declared);
  let size = 0;
  const inflater = new Inflate((chunk) => {
    if (size + chunk.length > declared) throw new ZipReadError("corrupt");
    out.set(chunk, size);
    size += chunk.length;
  });
  try {
    if (raw.length === 0) inflater.push(raw, true);
    for (let i = 0; i < raw.length; i += CHUNK) inflater.push(raw.subarray(i, i + CHUNK), i + CHUNK >= raw.length);
  } catch (err) {
    if (err instanceof ZipReadError) throw err;
    throw new ZipReadError("corrupt");
  }
  return out.subarray(0, size);
}

function inflate(bytes: Uint8Array, e: Entry): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (e.offset + 30 > bytes.length || view.getUint32(e.offset, true) !== 0x04034b50) throw new ZipReadError("corrupt");
  const start = e.offset + 30 + view.getUint16(e.offset + 26, true) + view.getUint16(e.offset + 28, true);
  if (start + e.csize > bytes.length) throw new ZipReadError("corrupt");
  const raw = bytes.subarray(start, start + e.csize);
  const data = e.method === 0 ? raw : inflateLimited(raw, e.usize);
  if (data.length !== e.usize || crc32(data) !== e.crc) throw new ZipReadError("corrupt");
  return data;
}

/** Valida o zip de uma demo pelo diretório central. Os arquivos são inflados um a um, sob demanda. */
export function openDemoZip(bytes: Uint8Array): OpenedZip {
  try {
    if (bytes.length > LIMITS.maxZipBytes) throw new ZipReadError("too_large");
    const all = readCentralDirectory(bytes);

    const files: Entry[] = [];
    const seen = new Set<string>();
    let total = 0;
    for (const e of all) {
      if (isUnsafePath(e.name)) throw new ZipReadError("unsafe_path");
      if (e.flags & 1) throw new ZipReadError("encrypted");
      if (e.madeByUnix && (e.mode & 0o170000) === 0o120000) throw new ZipReadError("symlink");
      if (e.name.endsWith("/") || isJunk(e.name)) continue;
      if (e.method !== 0 && e.method !== 8) throw new ZipReadError("unsupported_zip");
      const ext = extensionOf(e.name);
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) throw new ZipReadError("extension_not_allowed");
      if (seen.has(e.name)) throw new ZipReadError("duplicate_path");
      seen.add(e.name);
      total += e.usize;
      if (total > LIMITS.maxTotalBytes) throw new ZipReadError("too_big_uncompressed");
      files.push(e);
    }
    if (files.length > LIMITS.maxFiles) throw new ZipReadError("too_many_files");

    let prefix = "";
    if (!seen.has("index.html")) {
      const top = new Set(files.map((f) => (f.name.includes("/") ? f.name.split("/")[0] : "")));
      const [dir] = [...top];
      if (top.size !== 1 || !dir || !seen.has(`${dir}/index.html`)) throw new ZipReadError("no_index");
      prefix = `${dir}/`;
    }

    return {
      ok: true,
      files: files.map((e) => ({ path: e.name.slice(prefix.length), read: () => inflate(bytes, e) })),
    };
  } catch (err) {
    if (err instanceof ZipReadError) return { ok: false, reason: err.reason };
    throw err;
  }
}

/** Valida e descompacta tudo de uma vez (útil para testes e zips pequenos). */
export function readDemoZip(bytes: Uint8Array): ZipResult {
  const opened = openDemoZip(bytes);
  if (!opened.ok) return opened;
  try {
    return { ok: true, files: opened.files.map((f) => ({ path: f.path, data: f.read() })) };
  } catch (err) {
    if (err instanceof ZipReadError) return { ok: false, reason: err.reason };
    throw err;
  }
}
