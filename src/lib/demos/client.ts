import type { DemoStatus } from "./url";

/** Erro devolvido pelo serviço de demos, com o status HTTP e a mensagem dele. */
export class DemoServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DemoServiceError";
  }
}

export type DemoServiceOptions = { base: URL; token: string; fetch?: typeof fetch };
export type EmbedResult = { embeddable: boolean; reason?: string };

async function call<T>(o: DemoServiceOptions, path: string, body?: unknown): Promise<T> {
  const f = o.fetch ?? fetch;
  const headers: Record<string, string> = { authorization: `Bearer ${o.token}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await f(new URL(path, o.base), { method: "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = {} as T & { error?: string };
  try {
    if (text) data = JSON.parse(text) as T & { error?: string };
  } catch {
    // Resposta que não é JSON (ex.: página de erro 502 de um proxy).
    throw new DemoServiceError(res.status, `Erro ${res.status} no serviço de demos. Tente de novo.`);
  }
  if (!res.ok) throw new DemoServiceError(res.status, data.error ?? `Erro ${res.status} no serviço de demos`);
  return data;
}

export const createUpload = (o: DemoServiceOptions) => call<{ demoId: string; uploadUrl: string }>(o, "/uploads");

export async function putZip(uploadUrl: string, file: Blob, f: typeof fetch = fetch): Promise<void> {
  const res = await f(uploadUrl, { method: "PUT", body: file });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new DemoServiceError(res.status, data.error ?? `Erro ${res.status} ao enviar o .zip`);
  }
}

export async function completeUpload(o: DemoServiceOptions, demoId: string): Promise<void> {
  await call(o, `/uploads/${demoId}/complete`);
}

export const embedCheck = (o: DemoServiceOptions, url: string) => call<EmbedResult>(o, "/embed-check", { url });
export const verifyDemo = (o: DemoServiceOptions, demoId: string) => call<EmbedResult>(o, `/demos/${demoId}/verify`);

export type DemoRow = { status: DemoStatus; rejection_reason: string | null };
export type WaitResult = { status: "live" } | { status: "unavailable"; reason: string | null } | { status: "timeout" };

/** Consulta a demo até a validação terminar (live ou unavailable) ou o tempo acabar. */
export async function waitForDemo(
  read: () => Promise<DemoRow | null>,
  opts: { intervalMs?: number; timeoutMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<WaitResult> {
  const { intervalMs = 1_500, timeoutMs = 90_000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = opts;
  const deadline = now() + timeoutMs;
  for (;;) {
    const row = await read();
    if (row?.status === "live") return { status: "live" };
    if (row?.status === "unavailable" || row?.status === "blocked") return { status: "unavailable", reason: row.rejection_reason };
    if (now() >= deadline) return { status: "timeout" };
    await sleep(intervalMs);
  }
}

/** Build automático de um repositório público do GitHub (serviço de demos + GitHub Actions). */
export const startBuild = (o: DemoServiceOptions, repo: string, ref?: string) =>
  call<{ demoId: string; buildId: string }>(o, "/builds", { repo, ref });

export const BUILD_STAGES = ["queued", "cloning", "installing", "building", "uploading", "validating", "ready"] as const;
export type BuildStage = (typeof BUILD_STAGES)[number] | "failed";
export type BuildRow = { stage: BuildStage; error: string | null; log: string | null; framework: string | null };
export type BuildResult = { status: "ready" } | { status: "failed"; error: string | null; log: string | null } | { status: "timeout" };

/** Consulta o build até ficar pronto ou falhar, avisando cada etapa nova. */
export async function waitForBuild(
  read: () => Promise<BuildRow | null>,
  onUpdate: (row: BuildRow) => void,
  opts: { intervalMs?: number; timeoutMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<BuildResult> {
  // O workflow tem 25 minutos; mais a fila do GitHub.
  const { intervalMs = 2_000, timeoutMs = 30 * 60_000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = opts;
  const deadline = now() + timeoutMs;
  let last = "";
  for (;;) {
    const row = await read();
    if (row) {
      const key = `${row.stage}:${row.framework ?? ""}`;
      if (key !== last) {
        last = key;
        onUpdate(row);
      }
      if (row.stage === "ready") return { status: "ready" };
      if (row.stage === "failed") return { status: "failed", error: row.error, log: row.log };
    }
    if (now() >= deadline) return { status: "timeout" };
    await sleep(intervalMs);
  }
}
