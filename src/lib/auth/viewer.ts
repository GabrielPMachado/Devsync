import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Papel admin e conta ativa (o banco confere de novo em cada ação de moderação). */
  isAdmin: boolean;
};

/** Quem está logado neste pedido, com o perfil. null para visitantes ou sem Supabase. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!getSupabaseEnv()) return null;
  // A sessão é sempre do pedido atual (o Supabase compara a validade do token com o relógio).
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub;
  if (!id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, role, suspended_at")
    .eq("id", id)
    .maybeSingle();

  return {
    id,
    email: (claims.claims.email as string | undefined) ?? null,
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isAdmin: profile?.role === "admin" && !profile?.suspended_at,
  };
});
