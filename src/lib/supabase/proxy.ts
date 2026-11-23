import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, type SupabaseEnv } from "@/lib/env";

/**
 * Renova a sessão do Supabase a cada pedido e devolve a resposta com os
 * cookies atualizados. Sem Supabase configurado, só deixa o pedido seguir.
 */
export async function updateSession(
  request: NextRequest,
  env: SupabaseEnv | null = getSupabaseEnv(),
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!env) return response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Não coloque código entre createServerClient e getClaims: é aqui que a sessão é renovada.
  await supabase.auth.getClaims();

  return response;
}
