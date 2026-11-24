"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { validateProfile, type ProfileErrors, type ProfileInput } from "@/lib/social/profile-rules";
import { createClient } from "@/lib/supabase/server";

export type SaveProfileState = { errors?: ProfileErrors; error?: "unknown"; values?: ProfileInput };

/** Salva o perfil (nome, bio, links, tecnologias) e volta para ele. */
export async function saveProfile(_prev: SaveProfileState, formData: FormData): Promise<SaveProfileState> {
  const viewer = await getViewer();
  if (!viewer?.username) redirect("/entrar?next=%2Fconfiguracoes");

  const values: ProfileInput = {
    displayName: String(formData.get("displayName") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    github: String(formData.get("github") ?? ""),
    site: String(formData.get("site") ?? ""),
    tags: formData.getAll("tags").map(String),
  };
  const check = validateProfile(values);
  if (!check.ok) return { errors: check.errors, values };
  const v = check.value;

  const supabase = await createClient();
  const { data: found } = v.tags.length ? await supabase.from("tags").select("id").in("slug", v.tags) : { data: [] };
  const tags = (found ?? []) as { id: string }[];
  if (tags.length !== v.tags.length) return { error: "unknown", values };

  const links: Record<string, string> = {};
  if (v.github) links.github = v.github;
  if (v.site) links.site = v.site;
  const { error } = await supabase.from("profiles").update({ display_name: v.displayName, bio: v.bio || null, links }).eq("id", viewer.id);
  if (error) return { error: "unknown", values };

  const { error: clearError } = await supabase.from("profile_tags").delete().eq("profile_id", viewer.id);
  const { error: tagError } = clearError || tags.length === 0
    ? { error: clearError }
    : await supabase.from("profile_tags").insert(tags.map((t) => ({ profile_id: viewer.id, tag_id: t.id })));
  if (tagError) return { error: "unknown", values };

  revalidatePath(`/u/${viewer.username}`);
  redirect(`/@${viewer.username}?salvo=1`);
}
