import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

/** Cliente do Supabase para componentes de cliente ("use client"). */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase não configurado: preencha o .env.local (veja .env.example).");
  return createBrowserClient(env.url, env.anonKey);
}
