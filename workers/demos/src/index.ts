import { defaultDeps, type Deps, type Env, type LinkMessage, type ZipMessage } from "./env";
import { errorResponse, withCors } from "./http";
import { buildProgress, failStaleBuilds, receiveBuildZip, startBuild } from "./builds";
import { purgeDeletedDemos } from "./deletions";
import { embedCheck, recheckLink, scheduleLinkChecks, verifyDemo } from "./links";
import { processZip } from "./process-zip";
import { parseDemoHost, routeDemoPath, serveDemo } from "./serve";
import { completeUpload, createUpload, receiveUpload } from "./uploads";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UPLOAD_FILE = new RegExp(`^/uploads/(${UUID})/(\\d+)$`);
const UPLOAD_COMPLETE = new RegExp(`^/uploads/(${UUID})/complete$`);
const DEMO_VERIFY = new RegExp(`^/demos/(${UUID})/verify$`);
const BUILD_PROGRESS = new RegExp(`^/builds/(${UUID})/progress$`);
const BUILD_ZIP = new RegExp(`^/builds/(${UUID})/zip$`);

const LINK_CHECK_CRON = "0 6 * * *";

/** Segundos que o cliente espera depois de passar do limite (o período do binding). */
const RATE_LIMIT_PERIOD = 60;

async function api(req: Request, env: Env, deps: Deps): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  // Chamadas do run de build (token OIDC do GitHub): fora do limite por IP, porque
  // vários runs podem sair do mesmo IP do GitHub.
  let m = BUILD_PROGRESS.exec(pathname);
  if (m && req.method === "POST") return buildProgress(req, env, m[1]!, deps);
  m = BUILD_ZIP.exec(pathname);
  if (m && req.method === "PUT") return receiveBuildZip(req, env, m[1]!, deps);
  if (env.API_LIMITER) {
    const key = req.headers.get("cf-connecting-ip") ?? "desconhecido";
    const { success } = await env.API_LIMITER.limit({ key });
    if (!success) {
      const res = errorResponse(429, "Muitas tentativas. Espere um minuto e tente de novo.");
      res.headers.set("retry-after", String(RATE_LIMIT_PERIOD));
      return res;
    }
  }
  if (req.method === "POST" && pathname === "/uploads") return createUpload(req, env, deps);
  if (req.method === "POST" && pathname === "/builds") return startBuild(req, env, deps);
  m = UPLOAD_FILE.exec(pathname);
  if (m && req.method === "PUT") return receiveUpload(req, env, m[1]!, Number(m[2]), deps);
  m = UPLOAD_COMPLETE.exec(pathname);
  if (m && req.method === "POST") return completeUpload(req, env, m[1]!, deps);
  m = DEMO_VERIFY.exec(pathname);
  if (m && req.method === "POST") return verifyDemo(req, env, m[1]!, deps);
  if (req.method === "POST" && pathname === "/embed-check") return embedCheck(req, env, deps);
  return errorResponse(404, "Rota não encontrada");
}

export async function handleFetch(req: Request, env: Env, deps: Deps): Promise<Response> {
  const host = new URL(req.url).hostname.toLowerCase();
  const demoId = parseDemoHost(host, env.DEMOS_HOST);
  if (demoId) return serveDemo(req, env, demoId, deps);
  if (host !== env.DEMOS_HOST.toLowerCase()) return new Response("Not found", { status: 404 });
  if (env.DEMOS_MODE === "path") {
    const demo = await routeDemoPath(req, env, deps);
    if (demo) return demo;
  }
  const res = await api(req, env, deps).catch((err) => {
    console.error("Erro na API de demos", err);
    return errorResponse(500, "Erro interno. Tente de novo em instantes.");
  });
  return withCors(res, req.headers.get("origin"), env);
}

export async function handleQueue(batch: MessageBatch<ZipMessage | LinkMessage>, env: Env, deps: Deps): Promise<void> {
  for (const msg of batch.messages) {
    try {
      if (batch.queue.startsWith("demo-zips")) await processZip(msg.body as ZipMessage, env, deps, msg.attempts);
      else if (batch.queue.startsWith("demo-links")) await recheckLink(msg.body as LinkMessage, env, deps);
      msg.ack();
    } catch (err) {
      console.error(`Falha ao processar ${batch.queue}`, err);
      msg.retry();
    }
  }
}

export default {
  fetch: (req, env) => handleFetch(req, env, defaultDeps()),
  queue: (batch, env) => handleQueue(batch, env, defaultDeps()),
  scheduled: (controller, env, ctx) => {
    // A cada 15 min: builds parados e arquivos de demos excluídas. Às 06:00 UTC: também a checagem diária dos links.
    if (controller.cron === LINK_CHECK_CRON) ctx.waitUntil(scheduleLinkChecks(env, defaultDeps()));
    ctx.waitUntil(failStaleBuilds(env, defaultDeps()));
    ctx.waitUntil(purgeDeletedDemos(env, defaultDeps()));
  },
} satisfies ExportedHandler<Env, ZipMessage | LinkMessage>;
