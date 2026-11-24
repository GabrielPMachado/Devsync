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
  const wanted = ((found ?? []) as { id: string }[]).map((t) => t.id);
  if (wanted.length !== v.tags.length) return { error: "unknown", values };

  const links: Record<string, string> = {};
  if (v.github) links.github = v.github;
  if (v.site) links.site = v.site;
  // .select() devolve as linhas alteradas: zero linhas = a RLS recusou (conta suspensa).
  const { data: updated, error } = await supabase.from("profiles").update({ display_name: v.displayName, bio: v.bio || null, links }).eq("id", viewer.id).select("id");
  if (error || !updated?.length) return { error: "unknown", values };

  // Troca só a diferença: se algo falhar no meio, as tecnologias que ficam não somem.
  const { data: current, error: readError } = await supabase.from("profile_tags").select("tag_id").eq("profile_id", viewer.id);
  if (readError) return { error: "unknown", values };
  const have = new Set(((current ?? []) as { tag_id: string }[]).map((r) => r.tag_id));
  const add = wanted.filter((id) => !have.has(id));
  const remove = [...have].filter((id) => !wanted.includes(id));
  if (add.length) {
    const { error: addError } = await supabase.from("profile_tags").insert(add.map((tag_id) => ({ profile_id: viewer.id, tag_id })));
    if (addError) return { error: "unknown", values };
  }
  if (remove.length) {
    const { error: removeError } = await supabase.from("profile_tags").delete().eq("profile_id", viewer.id).in("tag_id", remove);
    if (removeError) return { error: "unknown", values };
  }

  revalidatePath(`/u/${viewer.username}`);
  redirect(`/@${viewer.username}?salvo=1`);
}
