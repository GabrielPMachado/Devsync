import type { Deps, Env } from "./env";
import { signShot } from "./signing";
import { serviceRest } from "./supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Por ciclo do cron (15 min). A cota grátis do Browser Rendering é de 10 min de navegador por dia. */
const BATCH = 3;
/** Validade do passe que deixa o navegador do print abrir a demo enviada. */
const SHOT_TTL_MS = 5 * 60_000;
const PREVIEW_PATH = /^\/previews\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(\d{1,9})\.jpg$/;

interface PreviewRow {
  id: string;
  kind: "web_upload" | "web_link";
  url: string | null;
  version: number;
}

class RateLimited extends Error {}

/** Endereço da demo enviada com o passe do print (`?shot=<expira>.<assinatura>`). */
export async function demoShotUrl(env: Env, demoId: string, now: number): Promise<string> {
  const exp = now + SHOT_TTL_MS;
  const shot = `${exp}.${await signShot(env.UPLOAD_SIGNING_SECRET, demoId, exp)}`;
  const base = env.DEMOS_MODE === "path" ? `https://${env.DEMOS_HOST}/d/${demoId}/` : `https://${demoId}.${env.DEMOS_HOST}/`;
  return `${base}?shot=${shot}`;
}

async function screenshot(env: Env, deps: Deps, url: string): Promise<ArrayBuffer> {
  const res = await deps.fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.BROWSER_RENDERING_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      url,
      viewport: { width: 1280, height: 720 },
      gotoOptions: { waitUntil: "networkidle2", timeout: 20_000 },
      screenshotOptions: { type: "jpeg", quality: 70 },
    }),
  });
  if (res.status === 429) {
    await res.body?.cancel();
    throw new RateLimited();
  }
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) {
    await res.body?.cancel();
    throw new Error(`Browser Rendering respondeu ${res.status}`);
  }
  return res.arrayBuffer();
}

/**
 * Print automático: projetos sem capa ganham uma imagem da demo para o card.
 * O cron chama a cada 15 min; sem BROWSER_RENDERING_TOKEN e CLOUDFLARE_ACCOUNT_ID,
 * fica desligado (o card mostra o desenho padrão).
 */
export async function capturePreviews(env: Env, deps: Deps): Promise<void> {
  if (!env.BROWSER_RENDERING_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return;
  const db = serviceRest(env, deps.fetch);
  const rows = (await db.rpc<PreviewRow[] | null>("pending_demo_previews", { max_rows: BATCH })) ?? [];
  for (const row of rows) {
    if (!UUID.test(row.id) || !Number.isInteger(row.version) || row.version < 1) continue;
    let target: string;
    if (row.kind === "web_upload") target = await demoShotUrl(env, row.id, deps.now());
    else if (row.url?.startsWith("https://")) target = row.url;
    else continue;

    let previewUrl: string | null = null;
    try {
      const image = await screenshot(env, deps, target);
      const key = `previews/${row.id}/${row.version}.jpg`;
      await env.DEMOS_BUCKET.put(key, image, {
        httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
      });
      // Prints de versões antigas saem.
      const old = await env.DEMOS_BUCKET.list({ prefix: `previews/${row.id}/` });
      const stale = old.objects.map((o) => o.key).filter((k) => k !== key);
      if (stale.length) await env.DEMOS_BUCKET.delete(stale);
      previewUrl = `https://${env.DEMOS_HOST}/${key}`;
    } catch (err) {
      // Limite da Cloudflare: para por aqui e tenta no próximo ciclo, sem contar falha.
      if (err instanceof RateLimited) return;
      console.error(`Print da demo ${row.id} falhou`, err);
    }
    await db.rpc("record_demo_preview", { demo_id: row.id, demo_version: row.version, preview_url: previewUrl });
  }
}

/** GET /previews/<id>/<versão>.jpg no host da API (público, com cache longo). Null se não for essa rota. */
export async function servePreview(req: Request, env: Env): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  if (!pathname.startsWith("/previews/")) return null;
  const m = PREVIEW_PATH.exec(pathname);
  if (!m || (req.method !== "GET" && req.method !== "HEAD")) return new Response("Not found", { status: 404 });
  const object = await env.DEMOS_BUCKET.get(`previews/${m[1]}/${m[2]}.jpg`);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "content-type": "image/jpeg",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "cross-origin-resource-policy": "cross-origin",
    etag: object.httpEtag,
  });
  if (req.method === "HEAD") {
    await object.body.cancel();
    return new Response(null, { headers });
  }
  return new Response(object.body, { headers });
}
