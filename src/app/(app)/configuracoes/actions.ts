"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { BADGE_KEYS, SHOWN_BADGES_MAX } from "@/lib/social/badges";
import { validateProfile, type ProfileErrors, type ProfileInput } from "@/lib/social/profile-rules";
import { createClient } from "@/lib/supabase/server";

/**
 * "badges": tentou exibir insígnia não conquistada (DS004); "frame": borda ainda bloqueada (DS005);
 * "unavailable": item desligado pela moderação (DS006).
 */
export type SaveProfileState = { errors?: ProfileErrors; error?: "unknown" | "badges" | "frame" | "unavailable"; values?: ProfileInput };

/** Salva o perfil (sobre, links, aparência, imagens, tecnologias) e volta para ele. */
export async function saveProfile(_prev: SaveProfileState, formData: FormData): Promise<SaveProfileState> {
  const viewer = await getViewer();
  if (!viewer?.username) redirect("/entrar?next=%2Fconfiguracoes");

  const text = (k: string) => String(formData.get(k) ?? "");
  const optional = (k: string) => (formData.has(k) ? text(k) : undefined);
  const values: ProfileInput = {
    displayName: text("displayName"),
    bio: text("bio"),
    headline: text("headline"),
    location: text("location"),
    status: text("status"),
    github: text("github"),
    linkedin: text("linkedin"),
    x: text("x"),
    youtube: text("youtube"),
    site: text("site"),
    bannerPreset: text("bannerPreset"),
    avatarFrame: text("avatarFrame"),
    accent: text("accent"),
    avatarUrl: optional("avatarUrl"),
    bannerUrl: optional("bannerUrl"),
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
  for (const key of ["github", "site", "linkedin", "x", "youtube"] as const) if (v[key]) links[key] = v[key];
  const row: Record<string, unknown> = {
    display_name: v.displayName,
    bio: v.bio || null,
    headline: v.headline || null,
    location: v.location || null,
    status: v.status || null,
    banner_preset: v.bannerPreset || null,
    avatar_frame: v.avatarFrame || null,
    accent: v.accent || null,
    links,
  };
  // Ausente = não mexe; "" = remove.
  if (v.avatarUrl !== undefined) row.avatar_url = v.avatarUrl || null;
  if (v.bannerUrl !== undefined) row.banner_url = v.bannerUrl || null;
  // A seção de insígnias manda "shownBadgesSet"; sem ela, não mexe nas exibidas.
  // O banco confere se foram conquistadas (DS004).
  if (formData.has("shownBadgesSet")) {
    const picked = formData.getAll("shown_badges").map(String);
    row.shown_badges = [...new Set(picked)].filter((b) => (BADGE_KEYS as readonly string[]).includes(b)).slice(0, SHOWN_BADGES_MAX);
  }
  // .select() devolve as linhas alteradas: zero linhas = a RLS recusou (conta suspensa).
  const { data: updated, error } = await supabase.from("profiles").update(row).eq("id", viewer.id).select("id");
  if (error?.code === "DS004") return { error: "badges", values };
  if (error?.code === "DS005") return { error: "frame", values };
  if (error?.code === "DS006") return { error: "unavailable", values };
  if (error || !updated?.length) return { error: "unknown", values };

  // Depois do perfil salvo, limpa a pasta (sem órfãos): removeu = apaga tudo;
  // trocou = apaga tudo menos o arquivo novo. Falhar aqui não desfaz o salvamento.
  if (v.avatarUrl !== undefined) await clearFolder(supabase, "avatars", viewer.id, fileName(v.avatarUrl));
  if (v.bannerUrl !== undefined) await clearFolder(supabase, "banners", viewer.id, fileName(v.bannerUrl));

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

/** Nome do arquivo no fim da URL do Storage ("" = nenhum). */
function fileName(url: string): string {
  return url ? (url.split(/[?#]/)[0].split("/").pop() ?? "") : "";
}

/** Apaga a pasta da pessoa (inclui fotos antigas do cadastro, como avatar-<ts>.png), menos `keep`. */
async function clearFolder(supabase: Awaited<ReturnType<typeof createClient>>, bucket: "avatars" | "banners", id: string, keep = "") {
  const { data } = await supabase.storage.from(bucket).list(id);
  const paths = (data ?? []).filter((f) => f.name !== keep).map((f) => `${id}/${f.name}`);
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}
