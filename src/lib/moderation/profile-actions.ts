"use server";

import { revalidatePath, updateTag } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { isBadgeKey } from "@/lib/social/badges";
import { isStatus } from "@/lib/social/profile-style";
import { createClient } from "@/lib/supabase/server";
import { CATALOG_TAG, isCatalogKey, isCatalogKind, isGrantKind } from "./catalog";

/**
 * Ações do /admin sobre perfis e catálogo. O banco (RPCs admin_*, assert_admin)
 * é a barreira real e grava o registro; aqui só validamos para dar mensagens boas.
 */

export type ProfileAdminResult = { ok: true } | { error: "forbidden" | "invalid" | "username" | "usernameTaken" | "tooLong" | "unknown" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function adminClient() {
  const viewer = await getViewer();
  return viewer?.isAdmin ? createClient() : null;
}

async function call(name: string, args: Record<string, unknown>, profileId?: string): Promise<ProfileAdminResult> {
  const supabase = await adminClient();
  if (!supabase) return { error: "forbidden" };
  const { error } = await supabase.rpc(name, args);
  if (error) {
    if (error.code === "23505") return { error: "usernameTaken" };
    if (error.code === "23514" || error.code === "22023") return { error: "invalid" };
    if (error.code === "42501") return { error: "forbidden" };
    return { error: "unknown" };
  }
  if (profileId) revalidatePath(`/admin/perfis/${profileId}`);
  return { ok: true };
}

export async function setCatalogItem(kind: string, key: string, active: boolean, label: string): Promise<ProfileAdminResult> {
  if (!(await getViewer())?.isAdmin) return { error: "forbidden" };
  const clean = label.trim();
  if (!isCatalogKind(kind) || !isCatalogKey(kind, key) || clean.length > 40) return { error: "invalid" };
  const res = await call("admin_set_catalog_item", { p_kind: kind, p_key: key, p_active: active, p_label: clean || null });
  if ("ok" in res) {
    updateTag(CATALOG_TAG);
    revalidatePath("/admin");
  }
  return res;
}

export async function setBadge(profileId: string, badge: string, give: boolean, notify = true): Promise<ProfileAdminResult> {
  if (!(await getViewer())?.isAdmin) return { error: "forbidden" };
  if (!UUID.test(profileId) || !isBadgeKey(badge)) return { error: "invalid" };
  return give
    ? call("admin_award_badge", { p_profile: profileId, p_badge: badge, p_notify: notify }, profileId)
    : call("admin_revoke_badge", { p_profile: profileId, p_badge: badge }, profileId);
}

export async function setItemGrant(profileId: string, kind: string, key: string, give: boolean): Promise<ProfileAdminResult> {
  if (!(await getViewer())?.isAdmin) return { error: "forbidden" };
  if (!UUID.test(profileId) || !isGrantKind(kind) || !isCatalogKey(kind, key)) return { error: "invalid" };
  const args = { p_profile: profileId, p_kind: kind, p_key: key };
  return call(give ? "admin_grant_item" : "admin_revoke_item", args, profileId);
}

export type ProfileChanges = {
  username?: string;
  displayName?: string;
  headline?: string;
  location?: string;
  status?: string;
  bio?: string;
  removeAvatar?: boolean;
  removeBanner?: boolean;
  resetAppearance?: boolean;
};

const LIMITS = { displayName: 80, headline: 80, location: 60, bio: 500 } as const;
const COLUMN = { displayName: "display_name", headline: "headline", location: "location", bio: "bio" } as const;

export async function updateProfileAsAdmin(profileId: string, changes: ProfileChanges): Promise<ProfileAdminResult> {
  if (!(await getViewer())?.isAdmin) return { error: "forbidden" };
  if (!UUID.test(profileId)) return { error: "invalid" };
  const out: Record<string, string | boolean> = {};
  if (changes.username !== undefined) {
    const u = changes.username.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9_]{3,30}$/.test(u)) return { error: "username" };
    out.username = u;
  }
  for (const field of ["displayName", "headline", "location", "bio"] as const) {
    const v = changes[field];
    if (v === undefined) continue;
    if (v.trim().length > LIMITS[field]) return { error: "tooLong" };
    out[COLUMN[field]] = v.trim();
  }
  if (changes.status !== undefined) {
    if (changes.status !== "" && !isStatus(changes.status)) return { error: "invalid" };
    out.status = changes.status;
  }
  if (changes.removeAvatar) out.remove_avatar = true;
  if (changes.removeBanner) out.remove_banner = true;
  if (changes.resetAppearance) out.reset_appearance = true;
  if (Object.keys(out).length === 0) return { ok: true };
  const res = await call("admin_update_profile", { p_profile: profileId, p_changes: out }, profileId);
  if ("ok" in res) revalidatePath("/u/[username]", "page");
  return res;
}
