import type { Deps, Env, ZipMessage } from "./env";
import { contentTypeFor } from "./content-types";
import { serviceRest } from "./supabase";
import { zipKey } from "./uploads";
import { openDemoZip, ZipReadError, type ZipRejection } from "./zip";

/** Tentativas reais antes de desistir (a fila demo-zips tem max_retries 4, ou seja 5 entregas). */
export const MAX_ZIP_ATTEMPTS = 4;

async function deletePrefix(bucket: R2Bucket, prefix: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    if (page.objects.length) await bucket.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

/** Consumidor da fila demo-zips: valida, descompacta no R2 e grava o resultado. */
export async function processZip(msg: ZipMessage, env: Env, deps: Deps, attempt = 1): Promise<void> {
  const key = zipKey(msg.demoId, msg.version);
  const prefix = `demos/${msg.demoId}/${msg.version}/`;
  const db = serviceRest(env, deps.fetch);
  // Só grava se a demo continuar pendente (não sobrescreve um bloqueio da moderação).
  const where = `id=eq.${msg.demoId}&status=eq.pending`;
  const reject = async (reason: ZipRejection | "processing_failed") => {
    await deletePrefix(env.DEMOS_BUCKET, prefix);
    await db.update("demos", where, { status: "unavailable", rejection_reason: reason });
    await env.DEMOS_BUCKET.delete(key);
  };

  const [demo] = await db.select<{ kind: string; status: string; version: number }>(
    "demos",
    `id=eq.${msg.demoId}&select=id,kind,status,version`,
  );
  if (!demo || demo.kind !== "web_upload" || demo.status !== "pending" || demo.version !== msg.version) {
    await env.DEMOS_BUCKET.delete(key);
    return;
  }
  // As tentativas anteriores falharam (ou estouraram o limite de CPU): a demo não fica pendente para sempre.
  if (attempt > MAX_ZIP_ATTEMPTS) return reject("processing_failed");

  const object = await env.DEMOS_BUCKET.get(key);
  if (!object) return;

  const opened = openDemoZip(new Uint8Array(await object.arrayBuffer()));
  if (!opened.ok) return reject(opened.reason);

  try {
    // Um arquivo por vez na memória.
    for (const file of opened.files) {
      await env.DEMOS_BUCKET.put(prefix + file.path, file.read(), {
        httpMetadata: { contentType: contentTypeFor(file.path) },
      });
    }
  } catch (err) {
    if (err instanceof ZipReadError) return reject(err.reason);
    throw err;
  }
  await db.update("demos", where, {
    status: "live",
    storage_prefix: prefix,
    version: msg.version,
    rejection_reason: null,
  });
  await env.DEMOS_BUCKET.delete(key);
}
