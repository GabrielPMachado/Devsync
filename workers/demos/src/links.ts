import { checkEmbeddable, type EmbedResult } from "./embed";
import type { Deps, Env, LinkMessage } from "./env";
import { errorResponse, json } from "./http";
import { serviceRest, userRest } from "./supabase";
import { requireUser } from "./uploads";

interface LinkDemo {
  id: string;
  kind: string;
  status: string;
  url: string | null;
}

const check = (url: string, env: Env, deps: Deps) =>
  checkEmbeddable(url, env.SITE_URL, { fetch: deps.fetch, safeBrowsingKey: env.SAFE_BROWSING_API_KEY || undefined });

/** Grava o resultado sem sobrescrever um bloqueio da moderação nem uma url trocada no meio. */
async function saveResult(env: Env, deps: Deps, demoId: string, url: string, result: EmbedResult): Promise<void> {
  // Filtra pela url checada: se o dono trocou a url durante a checagem, o
  // resultado antigo não publica a url nova.
  const where = `id=eq.${demoId}&status=neq.blocked&url=eq.${encodeURIComponent(url)}`;
  await serviceRest(env, deps.fetch).update("demos", where, {
    status: result.embeddable ? "live" : "unavailable",
    embeddable: result.embeddable,
    checked_at: new Date(deps.now()).toISOString(),
  });
}

/** POST /embed-check { url }: pré-checagem do formulário de publicação. */
export async function embedCheck(req: Request, env: Env, deps: Deps): Promise<Response> {
  if (!(await requireUser(req, env, deps))) return errorResponse(401, "Entre na Devsync para continuar");
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  if (typeof body?.url !== "string") return errorResponse(400, "Informe a url");
  return json(await check(body.url, env, deps));
}

/** POST /demos/:demoId/verify: checa o link da demo do usuário e publica (live) ou não (unavailable). */
export async function verifyDemo(req: Request, env: Env, demoId: string, deps: Deps): Promise<Response> {
  const auth = await requireUser(req, env, deps);
  if (!auth) return errorResponse(401, "Entre na Devsync para continuar");
  const [demo] = await userRest(env, auth.token, deps.fetch).select<LinkDemo>(
    "demos",
    `id=eq.${demoId}&owner_id=eq.${auth.user.id}&select=id,kind,status,url`,
  );
  if (!demo || demo.kind !== "web_link" || !demo.url) return errorResponse(404, "Demo não encontrada");
  if (demo.status === "blocked") return errorResponse(409, "Esta demo foi suspensa pela moderação");
  const result = await check(demo.url, env, deps);
  await saveResult(env, deps, demoId, demo.url, result);
  return json(result);
}

/** Cron diário: enfileira os links publicados, os checados há mais tempo primeiro. */
export async function scheduleLinkChecks(env: Env, deps: Deps): Promise<void> {
  const rows = await serviceRest(env, deps.fetch).select<{ id: string }>(
    "demos",
    "kind=eq.web_link&status=in.(live,unavailable)&select=id&order=checked_at.asc.nullsfirst&limit=1000",
  );
  for (let i = 0; i < rows.length; i += 100) {
    await env.LINK_QUEUE.sendBatch(rows.slice(i, i + 100).map((r) => ({ body: { demoId: r.id } })));
  }
}

/** Consumidor da fila demo-links. */
export async function recheckLink(msg: LinkMessage, env: Env, deps: Deps): Promise<void> {
  const [demo] = await serviceRest(env, deps.fetch).select<LinkDemo>(
    "demos",
    `id=eq.${msg.demoId}&select=id,kind,status,url`,
  );
  if (!demo || demo.kind !== "web_link" || !demo.url || demo.status === "blocked") return;
  await saveResult(env, deps, msg.demoId, demo.url, await check(demo.url, env, deps));
}
