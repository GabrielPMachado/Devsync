export interface Call {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
}

/** fetch falso: registra as chamadas e responde com `handler`. */
export function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const call: Call = {
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body ? await req.text() : null,
    };
    calls.push(call);
    return handler(call);
  };
  return { fetch: f as typeof fetch, calls };
}

import { deflateSync } from "fflate";
import { crc32 } from "../src/zip";

export interface ZipEntry {
  name: string;
  data?: string | Uint8Array;
  /** Modo unix (ex.: 0o100644, 0o120777 para link simbólico). */
  mode?: number;
  flags?: number;
  method?: 0 | 8;
  /** Mente o tamanho descompactado no diretório central. */
  declaredSize?: number;
}

/** Monta um zip byte a byte, com controle total dos campos que o validador lê. */
export function makeZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const raw = typeof e.data === "string" ? enc.encode(e.data) : (e.data ?? new Uint8Array());
    const method = e.method ?? 8;
    const body = method === 8 ? deflateSync(raw) : raw;
    const crc = crc32(raw);
    const usize = e.declaredSize ?? raw.length;
    const flags = (e.flags ?? 0) | 0x800;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, flags, true);
    local.setUint16(8, method, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, usize, true);
    local.setUint16(26, name.length, true);
    locals.push(new Uint8Array(local.buffer), name, body);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, (3 << 8) | 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, flags, true);
    central.setUint16(10, method, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, body.length, true);
    central.setUint32(24, usize, true);
    central.setUint16(28, name.length, true);
    central.setUint32(38, ((e.mode ?? (e.name.endsWith("/") ? 0o40755 : 0o100644)) << 16) >>> 0, true);
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let p = 0;
  for (const b of parts) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

export const SITE = [
  { name: "index.html", data: "<!doctype html><h1>Oi</h1>" },
  { name: "assets/app.js", data: "console.log('oi')" },
  { name: "assets/style.css", data: "h1{color:red}" },
];
