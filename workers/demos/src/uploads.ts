import type { Deps, Env } from "./env";
import { errorResponse, json } from "./http";
import { signUpload, verifyUpload } from "./signing";
import { bearer, getUser, SupabaseError, userRest } from "./supabase";
import { LIMITS } from "./zip";

const UPLOAD_TTL_MS = 10 * 60_000;

export const zipKey = (demoId: string, version: number) => `uploads/${demoId}/${version}.zip`;

export async function requireUser(req: Request, env: Env, deps: Deps) {
  const token = bearer(req);
  const user = token ? await getUser(env, token, deps.fetch) : null;
  return token && user ? { token, user } : null;
}

/** Cria a demo `web_upload` como o usuário: e-mail confirmado, limite diário e suspensão valem. */
export async function insertUploadDemo(env: Env, token: string, deps: Deps): Promise<{ id: string; version: number } | Response> {
  try {
    return await userRest(env, token, deps.fetch).insert<{ id: string; version: number }>("demos", { kind: "web_upload" });
  } catch (err) {
    if (err instanceof SupabaseError) {
      if (err.code === "DS001") return errorResponse(429, err.message);
      if (err.code === "DS002") return errorResponse(403, err.message);
      if (err.code === "42501") return errorResponse(403, "Sua conta não pode enviar demos agora");
    }
    throw err;
  }
}

export const unauthorized = () => errorResponse(401, "Entre na Devsync para continuar");

/** POST /uploads: cria a demo como o usuário (RLS e limites do banco valem). */
export async function createUpload(req: Request, env: Env, deps: Deps): Promise<Response> {
  const auth = await requireUser(req, env, deps);
  if (!auth) return unauthorized();
  const demo = await insertUploadDemo(env, auth.token, deps);
  if (demo instanceof Response) return demo;
  const version = demo.version ?? 1;
  const expires = deps.now() + UPLOAD_TTL_MS;
  const sig = await signUpload(env.UPLOAD_SIGNING_SECRET, demo.id, version, expires);
  const uploadUrl = `${new URL(req.url).origin}/uploads/${demo.id}/${version}?expires=${expires}&sig=${sig}`;
  return json({ demoId: demo.id, uploadUrl }, 201);
}

/** PUT /uploads/:demoId/:version?expires&sig: grava o zip no R2. */
export async function receiveUpload(req: Request, env: Env, demoId: string, version: number, deps: Deps): Promise<Response> {
  const url = new URL(req.url);
  const ok = await verifyUpload(
    env.UPLOAD_SIGNING_SECRET,
    demoId,
    version,
    Number(url.searchParams.get("expires")),
    url.searchParams.get("sig") ?? "",
    deps.now(),
  );
  if (!ok) return errorResponse(403, "Link de envio inválido ou expirado");

  const length = Number(req.headers.get("content-length"));
  if (!Number.isInteger(length) || length <= 0 || !req.body) return errorResponse(411, "Envie o arquivo com Content-Length");
  if (length > LIMITS.maxZipBytes) return errorResponse(413, "O zip pode ter no máximo 25 MB");

  const key = zipKey(demoId, version);
  if (await env.DEMOS_BUCKET.head(key)) return errorResponse(409, "Este envio já foi feito");
  // Condicional: dois PUTs simultâneos não sobrescrevem um ao outro.
  const saved = await env.DEMOS_BUCKET.put(key, req.body, {
    httpMetadata: { contentType: "application/zip" },
    onlyIf: { etagDoesNotMatch: "*" },
  });
  if (!saved) return errorResponse(409, "Este envio já foi feito");
  return json({ ok: true }, 201);
}

/** POST /uploads/:demoId/complete: confere a demo e enfileira a validação. */
export async function completeUpload(req: Request, env: Env, demoId: string, deps: Deps): Promise<Response> {
  const auth = await requireUser(req, env, deps);
  if (!auth) return unauthorized();
  const [demo] = await userRest(env, auth.token, deps.fetch).select<{ kind: string; status: string; version: number }>(
    "demos",
    `id=eq.${demoId}&owner_id=eq.${auth.user.id}&select=id,kind,status,version`,
  );
  if (!demo || demo.kind !== "web_upload") return errorResponse(404, "Demo não encontrada");
  if (demo.status !== "pending") return errorResponse(409, "Esta demo já foi processada");
  if (!(await env.DEMOS_BUCKET.head(zipKey(demoId, demo.version)))) {
    return errorResponse(409, "Envie o arquivo antes de concluir");
  }
  await env.ZIP_QUEUE.send({ demoId, version: demo.version });
  return json({ status: "pending" }, 202);
}
