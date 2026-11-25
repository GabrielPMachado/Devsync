"use server";

import { redirect } from "next/navigation";
import { validateUsername, type UsernameProblem } from "@/lib/auth/username";
import { AVATAR_MAX_BYTES, MIN_TAGS } from "@/lib/auth/onboarding-rules";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export type UsernameStatus = "available" | "taken" | UsernameProblem;

export type OnboardingState = {
  errors?: {
    username?: UsernameProblem | "taken";
    displayName?: "required";
    tags?: "min";
    avatar?: "tooBig";
    form?: "unknown";
  };
};

const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent("/boas-vindas")}`);
  return viewer;
}

export async function checkUsername(raw: string): Promise<UsernameStatus> {
  const check = validateUsername(raw);
  if (!check.ok) return check.reason;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id").eq("username", check.username).neq("id", viewer.id).maybeSingle();
  return data ? "taken" : "available";
}

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const viewer = await requireViewer();

  const errors: NonNullable<OnboardingState["errors"]> = {};
  const check = validateUsername(formData.get("username")?.toString() ?? "");
  if (!check.ok) errors.username = check.reason;
  const displayName = (formData.get("displayName")?.toString() ?? "").trim().slice(0, 80);
  if (!displayName) errors.displayName = "required";
  const slugs = [...new Set(formData.getAll("tags").map((t) => t.toString().trim().toLowerCase()).filter(Boolean))];
  if (slugs.length < MIN_TAGS) errors.tags = "min";
  const avatar = formData.get("avatar");
  const file = avatar instanceof File && avatar.size > 0 ? avatar : null;
  if (file && (file.size > AVATAR_MAX_BYTES || !AVATAR_TYPES[file.type])) errors.avatar = "tooBig";
  if (Object.keys(errors).length > 0 || !check.ok) return { errors };

  const supabase = await createClient();
  const update: { username: string; display_name: string; avatar_url?: string } = { username: check.username, display_name: displayName };

  if (file) {
    const path = `${viewer.id}/avatar-${Date.now()}.${AVATAR_TYPES[file.type]}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { errors: { avatar: "tooBig" } };
    update.avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", viewer.id);
  if (error?.code === "23505") return { errors: { username: "taken" } };
  if (error?.code === "23514") return { errors: { username: "chars" } };
  if (error) return { errors: { form: "unknown" } };

  const { data: tags } = await supabase.from("tags").select("id, slug").in("slug", slugs);
  const rows = (tags ?? []).map((t) => ({ profile_id: viewer.id, tag_id: t.id }));
  if (rows.length > 0) await supabase.from("tag_follows").upsert(rows, { onConflict: "profile_id,tag_id", ignoreDuplicates: true });

  redirect("/");
}
