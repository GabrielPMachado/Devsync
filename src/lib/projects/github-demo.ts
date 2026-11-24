import { zipSync } from "fflate";
import { call, GithubError, type FetchFn, type GithubRepo } from "./github";

/** Demo a partir dos arquivos do repositório: acha um site pronto e monta o .zip no navegador. */

export type SiteSource = { ref: string; folder: string; files: { path: string; size: number }[] };
export type SiteLookup = { kind: "found"; source: SiteSource } | { kind: "needs_build" } | { kind: "none" } | { kind: "too_big" };

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
/** Mesmos limites do serviço de demos (workers/demos/README.md). */
export const SITE_MAX_FILES = 500;
export const SITE_MAX_BYTES = 60 * 1024 * 1024;
const FOLDERS = ["dist/", "build/", "docs/", "out/", ""];

/** Cópia das extensões aceitas pelo serviço de demos (workers/demos/src/content-types.ts). */
const EXTENSIONS = new Set(
  "html htm css js mjs cjs json map webmanifest txt md csv xml wasm svg png jpg jpeg gif webp avif ico bmp woff woff2 ttf otf eot mp3 wav ogg m4a mp4 webm glb gltf bin pdf".split(" "),
);

export function isDemoFile(path: string): boolean {
  const parts = path.split("/");
  if (parts.some((p) => p.startsWith(".") || p === "node_modules")) return false;
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf(".");
  return dot > 0 && EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/** Primeira pasta com index.html: dist, build, docs, out, raiz. */
export function pickFolder(paths: string[]): string | null {
  const set = new Set(paths);
  return FOLDERS.find((f) => set.has(`${f}index.html`)) ?? null;
}

/** index.html de projeto que ainda precisa compilar (Vite, CRA com TS/JSX…). */
export function needsBuild(html: string): boolean {
  return /<script\b[^>]*\bsrc\s*=\s*["']?[^"'\s>]*\.(tsx?|jsx|vue|svelte)(\?[^"'\s>]*)?["'\s>]/i.test(html);
}

type TreeItem = { path: string; type: string; size?: number };

async function readTree(repo: GithubRepo, ref: string, fetchFn: FetchFn): Promise<{ truncated: boolean; items: TreeItem[] } | null> {
  const r = await call(`${API}/repos/${repo.fullName}/git/trees/${encodeURIComponent(ref)}?recursive=1`, fetchFn);
  if (r.status === 404 || r.status === 409) return null; // sem a branch, ou repo vazio
  if (!r.ok) throw new GithubError("network");
  const body = (await r.json()) as { truncated?: boolean; tree?: TreeItem[] };
  return { truncated: !!body.truncated, items: body.tree ?? [] };
}

function rawUrl(repo: GithubRepo, ref: string, path: string) {
  return `${RAW}/${repo.fullName}/${ref.split("/").map(encodeURIComponent).join("/")}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function download(url: string, fetchFn: FetchFn): Promise<Response> {
  let r: Response;
  try {
    r = await fetchFn(url, undefined);
  } catch {
    throw new GithubError("network");
  }
  if (!r.ok) throw new GithubError("network");
  return r;
}

/** Procura um site pronto: branch gh-pages, senão a branch padrão. */
export async function findSiteSource(repo: GithubRepo, fetchFn: FetchFn = fetch): Promise<SiteLookup> {
  for (const ref of ["gh-pages", repo.defaultBranch]) {
    const tree = await readTree(repo, ref, fetchFn);
    if (!tree) continue;
    const blobs = tree.items.filter((i) => i.type === "blob");
    const folder = pickFolder(blobs.map((b) => b.path));
    if (folder === null) {
      if (tree.truncated) return { kind: "too_big" };
      continue;
    }
    const files = blobs.filter((b) => b.path.startsWith(folder) && isDemoFile(b.path)).map((b) => ({ path: b.path, size: b.size ?? 0 }));
    const total = files.reduce((s, f) => s + f.size, 0);
    if (tree.truncated || files.length > SITE_MAX_FILES || total > SITE_MAX_BYTES) return { kind: "too_big" };
    const html = await (await download(rawUrl(repo, ref, `${folder}index.html`), fetchFn)).text();
    if (needsBuild(html)) return { kind: "needs_build" };
    return { kind: "found", source: { ref, folder, files } };
  }
  return { kind: "none" };
}

/** Baixa os arquivos do site (6 de cada vez) e devolve o .zip pronto para o envio de demo. */
export async function buildDemoZip(repo: GithubRepo, source: SiteSource, fetchFn: FetchFn = fetch): Promise<File> {
  const out: Record<string, Uint8Array> = {};
  const queue = [...source.files];
  async function worker() {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const r = await download(rawUrl(repo, source.ref, f.path), fetchFn);
      out[f.path.slice(source.folder.length)] = new Uint8Array(await r.arrayBuffer());
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
  const zip = zipSync(out, { level: 6 });
  return new File([zip as BlobPart], `${repo.name}.zip`, { type: "application/zip" });
}
