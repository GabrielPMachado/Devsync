import { defaultDeps, type Deps, type Env, type LinkMessage, type ZipMessage } from "./env";
import { errorResponse, withCors } from "./http";
import { processZip } from "./process-zip";
import { parseDemoHost, serveDemo } from "./serve";
import { completeUpload, createUpload, receiveUpload } from "./uploads";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UPLOAD_FILE = new RegExp(`^/uploads/(${UUID})/(\\d+)$`);
const UPLOAD_COMPLETE = new RegExp(`^/uploads/(${UUID})/complete$`);

async function api(req: Request, env: Env, deps: Deps): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method === "POST" && pathname === "/uploads") return createUpload(req, env, deps);
  let m = UPLOAD_FILE.exec(pathname);
  if (m && req.method === "PUT") return receiveUpload(req, env, m[1]!, Number(m[2]), deps);
  m = UPLOAD_COMPLETE.exec(pathname);
  if (m && req.method === "POST") return completeUpload(req, env, m[1]!, deps);
  return errorResponse(404, "Rota não encontrada");
}

export async function handleFetch(req: Request, env: Env, deps: Deps): Promise<Response> {
  const host = new URL(req.url).hostname.toLowerCase();
  const demoId = parseDemoHost(host, env.DEMOS_HOST);
  if (demoId) return serveDemo(req, env, demoId, deps);
  if (host !== env.DEMOS_HOST.toLowerCase()) return new Response("Not found", { status: 404 });
  const res = await api(req, env, deps).catch((err) => {
    console.error("Erro na API de demos", err);
    return errorResponse(500, "Erro interno. Tente de novo em instantes.");
  });
  return withCors(res, req.headers.get("origin"), env);
}

export async function handleQueue(batch: MessageBatch<ZipMessage | LinkMessage>, env: Env, deps: Deps): Promise<void> {
  for (const msg of batch.messages) {
    try {
      if (batch.queue.startsWith("demo-zips")) await processZip(msg.body as ZipMessage, env, deps);
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
} satisfies ExportedHandler<Env, ZipMessage | LinkMessage>;
