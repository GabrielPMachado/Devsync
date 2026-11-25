import type { Deps, Env } from "./env";
import { deletePrefix } from "./process-zip";
import { serviceRest } from "./supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BATCH = 50;

/**
 * Apaga do R2 os arquivos das demos excluídas (projeto excluído, demo apagada ou
 * conta apagada), com os prints. O banco põe cada demo apagada na fila private.demo_deletions;
 * o cron chama isto a cada 15 min.
 */
export async function purgeDeletedDemos(env: Env, deps: Deps): Promise<void> {
  const db = serviceRest(env, deps.fetch);
  const ids = (await db.rpc<string[] | null>("pending_demo_deletions", { max_rows: BATCH })) ?? [];
  // Só ids de verdade: um prefixo vazio ou estranho apagaria arquivos de outras demos.
  const valid = ids.filter((id) => UUID.test(id));
  if (!valid.length) return;
  for (const id of valid) {
    await deletePrefix(env.DEMOS_BUCKET, `demos/${id}/`);
    await deletePrefix(env.DEMOS_BUCKET, `uploads/${id}/`);
    await deletePrefix(env.DEMOS_BUCKET, `previews/${id}/`);
  }
  await db.rpc("finish_demo_deletions", { demo_ids: valid });
}
