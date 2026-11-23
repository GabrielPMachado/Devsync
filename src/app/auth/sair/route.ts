import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Sair: só por POST (formulário do menu da conta), para um link não deslogar ninguém. */
export async function POST(request: NextRequest) {
  if (getSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
