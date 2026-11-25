import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseEnv } from "@/lib/env";
import { CATALOG_TAG, isCatalogKind, type CatalogRow } from "./catalog";



/**
 * Linhas de catalog_item_state (poucas: só o que a moderação mudou). Em cache;
 * as ações do /admin chamam updateTag(CATALOG_TAG). Sem Supabase, catálogo todo ligado.
 */
export async function getCatalogRows(): Promise<CatalogRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const env = getSupabaseEnv();
  if (!env) return [];
  try {
    const supabase = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("catalog_item_state").select("kind, key, active, label");
    if (error) {
      console.error("catálogo: falha ao ler o estado", error.message);
      return [];
    }
    return (data ?? []).filter((r): r is CatalogRow => isCatalogKind(r.kind));
  } catch {
    return [];
  }
}
