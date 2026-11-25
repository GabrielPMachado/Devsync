import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseEnv } from "@/lib/env";
import { CATALOG_TAG, isCatalogKind, type CatalogRow } from "./catalog";

/**
 * Linhas de catalog_item_state (poucas: só o que a moderação mudou). Em cache por horas;
 * as ações do /admin chamam updateTag(CATALOG_TAG). Sem Supabase, catálogo todo ligado.
 * Erro de leitura (banco fora do ar, migration ainda não aplicada) não pode quebrar o build
 * nem o site: devolve "tudo ligado" e guarda só por minutos.
 */
export async function getCatalogRows(): Promise<CatalogRow[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const env = getSupabaseEnv();
  if (!env) return [];
  try {
    const supabase = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("catalog_item_state").select("kind, key, active, label");
    if (error) throw new Error(error.message);
    cacheLife("hours");
    return (data ?? []).filter((r): r is CatalogRow => isCatalogKind(r.kind));
  } catch (e) {
    console.error("catálogo: falha ao ler o estado", e instanceof Error ? e.message : e);
    cacheLife("minutes");
    return [];
  }
}
