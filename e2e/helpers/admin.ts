import { createClient } from "@supabase/supabase-js";

/**
 * Promove alguém a admin no Supabase local (chave service_role do CI).
 * No CI vêm de `supabase status -o env`; localmente, exporte as duas variáveis.
 */
export function adminEnv() {
  const url = process.env.E2E_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export async function makeAdmin(username: string) {
  const env = adminEnv();
  if (!env) throw new Error("Defina E2E_SUPABASE_URL e E2E_SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(env.url, env.key, { auth: { persistSession: false } });
  const { error, count } = await supabase.from("profiles").update({ role: "admin" }, { count: "exact" }).eq("username", username);
  if (error || count !== 1) throw new Error(`Não deu para promover @${username}: ${error?.message ?? count}`);
}
