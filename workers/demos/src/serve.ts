import { allowedOrigins, type Deps, type Env } from "./env";
import { isHtml, extensionOf } from "./content-types";
import { anonRest } from "./supabase";

interface DemoRow {
  id: string;
  kind: string;
  status: string;
  storage_prefix: string | null;
}

const CACHE_MS = 30_000;
const CACHE_MAX = 5_000;
const cache = new Map<string, { row: DemoRow | null; at: number }>();

export function clearDemoCache(): void {
  cache.clear();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** `<uuid>.<DEMOS_HOST>` → uuid. Qualquer outro host → null. */
export function parseDemoHost(hostname: string, demosHost: string): string | null {
  const host = hostname.toLowerCase();
  const suffix = `.${demosHost.toLowerCase()}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  return UUID.test(label) ? label : null;
}

async function lookup(env: Env, demoId: string, deps: Deps): Promise<DemoRow | null> {
  const hit = cache.get(demoId);
  if (hit && deps.now() - hit.at < CACHE_MS) return hit.row;
  // Chave anon: a RLS só devolve demos live/unavailable. Bloqueada some daqui.
  const rows = await anonRest(env, deps.fetch).select<DemoRow>(
    "demos",
    `id=eq.${demoId}&select=id,kind,status,storage_prefix`,
  );
  const row = rows[0] ?? null;
  // Subdomínios aleatórios não fazem o cache crescer sem limite.
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(demoId, { row, at: deps.now() });
  return row;
}

function securityHeaders(env: Env): Headers {
  return new Headers({
    "content-security-policy": `frame-ancestors ${allowedOrigins(env).join(" ")}`,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
}

function notFound(env: Env, message = "Não encontrado"): Response {
  const headers = securityHeaders(env);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${message}</title>` +
      `<body style="font-family:system-ui;background:#0B1120;color:#E2E8F0;display:grid;place-items:center;height:100vh;margin:0">` +
      `<p>${message}</p></body></html>`,
    { status: 404, headers },
  );
}

function redirectToSite(env: Env, demoId: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: `${new URL(env.SITE_URL).origin}/demo/${demoId}`, "cache-control": "no-store" },
  });
}

/** Caminho do pedido → caminho relativo seguro dentro da demo, ou null. */
function safePath(pathname: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (path.includes("\\") || /[\u0000-\u001f]/.test(path)) return null;
  const segments = path.split("/").slice(1);
  if (segments.some((s) => s === "." || s === "..")) return null;
  const rel = segments.join("/");
  return rel === "" || rel.endsWith("/") ? `${rel}index.html` : rel;
}

const DEMO_PATH = /^\/d\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/.*)?$/i;

/**
 * Modo pastas (`DEMOS_MODE=path`): demos em `/d/<id>/` no host da API. Devolve a
 * resposta para pedidos de demo, ou null para a API seguir.
 * - `/d/<id>` sem barra: redireciona para `/d/<id>/` (os caminhos relativos dependem dela).
 * - `/qualquer/coisa` pedido de dentro de uma demo (Referer `/d/<id>/...` do mesmo
 *   host): redireciona para a pasta da demo. Assim builds com caminhos absolutos
 *   (`/assets/app.js`, o padrão do Vite) funcionam sem reconfigurar.
 */
export async function routeDemoPath(req: Request, env: Env, deps: Deps): Promise<Response | null> {
  const url = new URL(req.url);
  const m = DEMO_PATH.exec(url.pathname);
  if (m) {
    const id = m[1]!.toLowerCase();
    if (!m[2]) return new Response(null, { status: 301, headers: { location: `/d/${id}/${url.search}` } });
    return serveDemo(req, env, id, deps, m[2]);
  }
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  const referer = req.headers.get("referer");
  if (!referer) return null;
  let from: URL;
  try {
    from = new URL(referer);
  } catch {
    return null;
  }
  const r = from.origin === url.origin ? DEMO_PATH.exec(from.pathname) : null;
  if (!r) return null;
  return new Response(null, {
    status: 307,
    headers: { location: `/d/${r[1]!.toLowerCase()}${url.pathname}${url.search}`, "cache-control": "no-store" },
  });
}

/** `pathname`: caminho dentro da demo (modo pastas); sem ele, o da URL (modo subdomínio). */
export async function serveDemo(req: Request, env: Env, demoId: string, deps: Deps, pathname?: string): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }
  // Uma demo não instala service worker: ele responderia à navegação direta
  // sem passar pelo redirecionamento abaixo.
  if (req.headers.has("service-worker")) return new Response("Forbidden", { status: 403 });

  const dest = req.headers.get("sec-fetch-dest");
  if (dest === "document") return redirectToSite(env, demoId);

  const path = safePath(pathname ?? new URL(req.url).pathname);
  if (!path) return notFound(env);

  const demo = await lookup(env, demoId, deps);
  if (!demo || demo.kind !== "web_upload" || demo.status !== "live" || !demo.storage_prefix) {
    return notFound(env, "Demo indisponível");
  }

  let resolved = path;
  let object = await env.DEMOS_BUCKET.get(demo.storage_prefix + resolved);
  if (!object && extensionOf(resolved) === null) {
    resolved = "index.html";
    object = await env.DEMOS_BUCKET.get(demo.storage_prefix + resolved);
  }
  if (!object) return notFound(env);

  // HTML só é servido para iframe: fora dele, vira a página da Devsync.
  if (isHtml(resolved) && dest !== "iframe" && dest !== "frame") {
    await object.body.cancel();
    return redirectToSite(env, demoId);
  }

  const headers = securityHeaders(env);
  // SVG/XML abertos fora de iframe (navegador sem Sec-Fetch-Dest) não rodam script.
  if (!isHtml(resolved)) headers.set("content-security-policy", `${headers.get("content-security-policy")}; sandbox`);
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", isHtml(resolved) ? "no-cache" : "public, max-age=60");
  if (req.method === "HEAD") {
    await object.body.cancel();
    return new Response(null, { status: 200, headers });
  }
  return new Response(object.body, { status: 200, headers });
}
