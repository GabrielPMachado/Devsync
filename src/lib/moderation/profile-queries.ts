import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AdminProfileRow = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  suspended: boolean;
  createdAt: string;
};

export type AdminHistoryEntry = { id: number; action: string; details: Record<string, unknown>; createdAt: string; adminUsername: string | null };

export type AdminProfile = AdminProfileRow & {
  headline: string | null;
  location: string | null;
  status: string | null;
  bio: string | null;
  bannerUrl: string | null;
  bannerPreset: string | null;
  accent: string | null;
  avatarFrame: string | null;
  badges: { badge: string; awardedAt: string }[];
  grants: { kind: string; key: string }[];
  history: AdminHistoryEntry[];
};

/** Busca por @ ou nome (vazio = mais recentes). Só admin: o banco confere. */
export async function findProfiles(query: string): Promise<AdminProfileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_find_profiles", { p_query: query.slice(0, 60) });
  if (error || !Array.isArray(data)) return [];
  return data.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    isAdmin: r.is_admin,
    suspended: r.suspended,
    createdAt: r.created_at,
  }));
}

export async function getAdminProfile(id: string): Promise<AdminProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_profile", { p_profile: id });
  if (error || !data) return null;
  const p = data as Record<string, unknown> & {
    badges: { badge: string; awarded_at: string }[];
    grants: { kind: string; key: string }[];
    history: { id: number; action: string; details: Record<string, unknown>; created_at: string; admin_username: string | null }[];
  };
  return {
    id: p.id as string,
    username: (p.username as string | null) ?? null,
    displayName: (p.display_name as string | null) ?? null,
    avatarUrl: (p.avatar_url as string | null) ?? null,
    isAdmin: !!p.is_admin,
    suspended: !!p.suspended,
    createdAt: p.created_at as string,
    headline: (p.headline as string | null) ?? null,
    location: (p.location as string | null) ?? null,
    status: (p.status as string | null) ?? null,
    bio: (p.bio as string | null) ?? null,
    bannerUrl: (p.banner_url as string | null) ?? null,
    bannerPreset: (p.banner_preset as string | null) ?? null,
    accent: (p.accent as string | null) ?? null,
    avatarFrame: (p.avatar_frame as string | null) ?? null,
    badges: (p.badges ?? []).map((b) => ({ badge: b.badge, awardedAt: b.awarded_at })),
    grants: p.grants ?? [],
    history: (p.history ?? []).map((h) => ({ id: h.id, action: h.action, details: h.details ?? {}, createdAt: h.created_at, adminUsername: h.admin_username })),
  };
}

/** Itens liberados à mão para a pessoa (leitura pública: a borda aparece no perfil de qualquer jeito). */
export async function getItemGrants(profileId: string): Promise<{ kind: string; key: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profile_item_grants").select("kind, key").eq("profile_id", profileId);
  if (error) return [];
  return data ?? [];
}
