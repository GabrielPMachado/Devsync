import type { Deps, Env } from "./env";
import { errorResponse, json } from "./http";
import { BUILD_WORKFLOW, verifyActionsToken } from "./oidc";
import { bearer, serviceRest } from "./supabase";
import { insertUploadDemo, requireUser, unauthorized, zipKey } from "./uploads";
import { LIMITS } from "./zip";

/**
 * Build automático: o Worker dispara o workflow do repositório de builds (GitHub
 * Actions), o run avisa cada etapa e envia o zip, autenticado pelo token OIDC dele.
 * Design: docs/superpowers/specs/2026-11-24-devsync-build-de-demos-design.md
 */

const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9._][A-Za-z0-9._/-]{0,254}$/;
/** Tamanho máximo do repositório (a API do GitHub devolve em KB). */
const MAX_REPO_KB = 200_000;
const LOG_MAX = 8000;

/** Etapas que o run pode gravar, na ordem. `validating` e `ready` só o serviço grava. */
const RUNNER_STAGES = ["queued", "cloning", "installing", "building", "uploading"] as const;
const FINAL = new Set(["validating", "ready", "failed"]);

type BuildRow = { id: string; demo_id: string; stage: string; run_id: number | null };

const github = (env: Env, deps: Deps, path: string, init: RequestInit = {}) =>
  deps.fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.BUILDER_GITHUB_TOKEN}`,
      "user-agent": "devsync-demos",
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });

async function failBuild(env: Env, deps: Deps, build: { id: string; demo_id: string }, patch: Record<string, unknown>) {
  const db = serviceRest(env, deps.fetch);
  await db.update("demo_builds", `id=eq.${build.id}`, { stage: "failed", ...patch });
  await db.update("demos", `id=eq.${build.demo_id}&status=eq.pending`, { status: "unavailable", rejection_reason: "build_failed" });
}

/** POST /builds { repo, ref? }: cria a demo como o usuário e dispara o build. */
export async function startBuild(req: Request, env: Env, deps: Deps): Promise<Response> {
  if (!env.BUILDER_REPO || !env.BUILDER_GITHUB_TOKEN) return errorResponse(503, "O build automático ainda não está ligado");
  const auth = await requireUser(req, env, deps);
  if (!auth) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { repo?: unknown; ref?: unknown };
  const repo = typeof body.repo === "string" ? body.repo.trim() : "";
  const wanted = body.ref === undefined || body.ref === null || body.ref === "" ? null : body.ref;
  if (!REPO.test(repo) || repo.split("/")[1]!.startsWith(".")) return errorResponse(400, "Repositório inválido");
  if (wanted !== null && (typeof wanted !== "string" || !REF.test(wanted) || wanted.includes(".."))) {
    return errorResponse(400, "Branch inválida");
  }

  const info = await github(env, deps, `/repos/${repo}`);
  if (info.status === 404) return errorResponse(404, "Repositório não encontrado no GitHub");
  if (!info.ok) return errorResponse(502, "O GitHub não respondeu. Tente de novo em instantes.");
  const data = (await info.json()) as { full_name: string; private: boolean; size: number; default_branch: string };
  if (data.private) return errorResponse(400, "Só repositórios públicos podem ser compilados");
  if (data.size > MAX_REPO_KB) return errorResponse(413, "O repositório passa de 200 MB");
  const ref = (wanted as string | null) ?? data.default_branch;

  const demo = await insertUploadDemo(env, auth.token, deps);
  if (demo instanceof Response) return demo;
  const db = serviceRest(env, deps.fetch);
  const build = await db.insert<{ id: string }>("demo_builds", { demo_id: demo.id, owner_id: auth.user.id, repo: data.full_name, ref });

  const dispatch = await github(env, deps, `/repos/${env.BUILDER_REPO}/actions/workflows/${BUILD_WORKFLOW}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: "main",
      inputs: { build_id: build.id, repo: data.full_name, ref, api: new URL(req.url).origin },
    }),
  }).catch(() => null);
  if (!dispatch || !dispatch.ok) {
    console.error("Falha ao disparar o build", dispatch?.status);
    await failBuild(env, deps, { id: build.id, demo_id: demo.id }, { error: "dispatch_failed" });
    return errorResponse(502, "Não deu para iniciar o build agora. Tente de novo em instantes.");
  }
  return json({ demoId: demo.id, buildId: build.id }, 201);
}

/** Confere o token do run e prende o build ao primeiro run que falar com ele. */
async function claimBuild(req: Request, env: Env, buildId: string, deps: Deps): Promise<BuildRow | Response> {
  const token = bearer(req);
  const run = token ? await verifyActionsToken(token, env, deps) : null;
  if (!run) return errorResponse(401, "Token do build inválido");
  const db = serviceRest(env, deps.fetch);
  const read = async () =>
    (await db.select<BuildRow>("demo_builds", `id=eq.${buildId}&select=id,demo_id,stage,run_id`))[0] ?? null;
  let build = await read();
  if (!build) return errorResponse(404, "Build não encontrado");
  if (build.run_id === null) {
    await db.update("demo_builds", `id=eq.${buildId}&run_id=is.null`, { run_id: run.runId });
    build = await read();
    if (!build) return errorResponse(404, "Build não encontrado");
  }
  if (Number(build.run_id) !== run.runId) return errorResponse(403, "Este build é de outro run");
  if (FINAL.has(build.stage)) return errorResponse(409, "Este build já terminou");
  return build;
}

/** POST /builds/:id/progress { stage, error?, log?, framework? } (chamado pelo run). */
export async function buildProgress(req: Request, env: Env, buildId: string, deps: Deps): Promise<Response> {
  const build = await claimBuild(req, env, buildId, deps);
  if (build instanceof Response) return build;

  const body = (await req.json().catch(() => ({}))) as { stage?: unknown; error?: unknown; log?: unknown; framework?: unknown };
  const stage = body.stage;
  const failed = stage === "failed";
  if (!failed && !(RUNNER_STAGES as readonly unknown[]).includes(stage)) return errorResponse(400, "Etapa inválida");
  if (body.error !== undefined && (typeof body.error !== "string" || !/^[a-z_]{1,60}$/.test(body.error))) {
    return errorResponse(400, "Código de erro inválido");
  }
  if (body.framework !== undefined && (typeof body.framework !== "string" || !/^[a-z0-9-]{1,40}$/.test(body.framework))) {
    return errorResponse(400, "Framework inválido");
  }
  if (!failed && RUNNER_STAGES.indexOf(stage as (typeof RUNNER_STAGES)[number]) < RUNNER_STAGES.indexOf(build.stage as (typeof RUNNER_STAGES)[number])) {
    return errorResponse(409, "Etapa fora de ordem");
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.framework === "string") patch.framework = body.framework;
  if (typeof body.log === "string") patch.log = body.log.slice(-LOG_MAX);
  if (failed) {
    await failBuild(env, deps, build, { ...patch, error: body.error ?? "build_failed" });
  } else {
    await serviceRest(env, deps.fetch).update("demo_builds", `id=eq.${buildId}`, { ...patch, stage });
  }
  return json({ ok: true });
}

/** PUT /builds/:id/zip (chamado pelo run): grava o zip e segue a validação de sempre. */
export async function receiveBuildZip(req: Request, env: Env, buildId: string, deps: Deps): Promise<Response> {
  const build = await claimBuild(req, env, buildId, deps);
  if (build instanceof Response) return build;

  const length = Number(req.headers.get("content-length"));
  if (!Number.isInteger(length) || length <= 0 || !req.body) return errorResponse(411, "Envie o arquivo com Content-Length");
  if (length > LIMITS.maxZipBytes) return errorResponse(413, "O zip pode ter no máximo 25 MB");

  const db = serviceRest(env, deps.fetch);
  const [demo] = await db.select<{ status: string; version: number }>("demos", `id=eq.${build.demo_id}&select=status,version`);
  if (!demo || demo.status !== "pending") return errorResponse(409, "Esta demo já foi processada");

  const key = zipKey(build.demo_id, demo.version);
  const saved = await env.DEMOS_BUCKET.put(key, req.body, {
    httpMetadata: { contentType: "application/zip" },
    onlyIf: { etagDoesNotMatch: "*" },
  });
  if (!saved) return errorResponse(409, "Este envio já foi feito");
  await db.update("demo_builds", `id=eq.${buildId}`, { stage: "validating" });
  await env.ZIP_QUEUE.send({ demoId: build.demo_id, version: demo.version });
  return json({ status: "validating" }, 202);
}
