import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Cliente do Supabase para Server Components, Server Actions e Route Handlers.
 * Crie um por pedido; nunca guarde em variável de módulo.
 */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase não configurado: preencha o .env.local (veja .env.example).");
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component: não dá para gravar cookie aqui.
          // Tudo bem, porque o proxy.ts já renova a sessão a cada pedido.
        }
      },
    },
  });
}
