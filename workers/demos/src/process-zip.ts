import type { Deps, Env, ZipMessage } from "./env";
import { contentTypeFor } from "./content-types";
import { serviceRest } from "./supabase";
import { zipKey } from "./uploads";
import { readDemoZip } from "./zip";

/** Consumidor da fila demo-zips: valida, descompacta no R2 e grava o resultado. */
export async function processZip(msg: ZipMessage, env: Env, deps: Deps): Promise<void> {
  const key = zipKey(msg.demoId, msg.version);
  const db = serviceRest(env, deps.fetch);

  const [demo] = await db.select<{ kind: string; status: string; version: number }>(
    "demos",
    `id=eq.${msg.demoId}&select=id,kind,status,version`,
  );
  if (!demo || demo.kind !== "web_upload" || demo.status !== "pending" || demo.version !== msg.version) {
    await env.DEMOS_BUCKET.delete(key);
    return;
  }

  const object = await env.DEMOS_BUCKET.get(key);
  if (!object) return;

  const result = readDemoZip(new Uint8Array(await object.arrayBuffer()));
  // Só grava se a demo continuar pendente (não sobrescreve um bloqueio da moderação).
  const where = `id=eq.${msg.demoId}&status=eq.pending`;
  if (result.ok) {
    const prefix = `demos/${msg.demoId}/${msg.version}/`;
    for (const file of result.files) {
      await env.DEMOS_BUCKET.put(prefix + file.path, file.data, {
        httpMetadata: { contentType: contentTypeFor(file.path) },
      });
    }
    await db.update("demos", where, {
      status: "live",
      storage_prefix: prefix,
      version: msg.version,
      rejection_reason: null,
    });
  } else {
    await db.update("demos", where, { status: "unavailable", rejection_reason: result.reason });
  }
  await env.DEMOS_BUCKET.delete(key);
}
