"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { checkTone } from "@/lib/moderation/tone";
import { COMMENT_MAX, validateProject, type ProjectErrors, type ProjectInput } from "@/lib/projects/rules";
import { createClient } from "@/lib/supabase/server";

/** Só páginas de projeto podem ser revalidadas e usadas como volta do login. */
function projectPath(path: string) {
  return /^\/projetos\/[a-z0-9-]{1,140}$/.test(path) ? path : "/projetos";
}

async function requireViewer(path: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(path)}`);
  return viewer;
}

export type PublishResult = { error: "invalid"; errors: ProjectErrors } | { error: "demo" | "unknown" };

/** Cria o projeto depois que a demo validou e abre a página dele. */
export async function publishProject(input: ProjectInput & { demoId: string }): Promise<PublishResult> {
  const viewer = await requireViewer("/projetos/novo");
  const check = validateProject(input);
  if (!check.ok) return { error: "invalid", errors: check.errors };
  const v = check.value;

  const supabase = await createClient();
  // A demo tem que ser da pessoa e já estar no ar (o banco só confere o dono).
  const { data: demo } = await supabase.from("demos").select("owner_id, status").eq("id", input.demoId).maybeSingle();
  if (!demo || demo.owner_id !== viewer.id || demo.status !== "live") return { error: "demo" };

  const { data: tags } = await supabase.from("tags").select("id").in("slug", v.tags);
  if (!tags || tags.length !== v.tags.length) return { error: "invalid", errors: { tags: "min" } };

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ title: v.title, description_md: v.description, repo_url: v.repoUrl || null, site_url: v.siteUrl || null, demo_id: input.demoId })
    .select("id, slug")
    .single();
  if (error || !project) return { error: "unknown" };

  const { error: tagError } = await supabase.from("project_tags").insert(tags.map((t: { id: string }) => ({ project_id: project.id, tag_id: t.id })));
  if (tagError) {
    // Sem as tags o projeto fica fora das regras: desfaz e deixa tentar de novo (a demo é reaproveitada).
    await supabase.from("projects").delete().eq("id", project.id);
    return { error: "unknown" };
  }

  revalidatePath("/projetos");
  redirect(`/projetos/${project.slug}?publicado=1`);
}

/** Curte ou descurte. Devolve o estado novo e o contador do banco; lança erro se o banco recusar. */
export async function toggleLike(projectId: string, rawPath: string): Promise<{ liked: boolean; count: number }> {
  const path = projectPath(rawPath);
  const viewer = await requireViewer(path);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("likes").select("project_id").eq("project_id", projectId).eq("profile_id", viewer.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("likes").delete().eq("project_id", projectId).eq("profile_id", viewer.id)
    : await supabase.from("likes").insert({ project_id: projectId });
  if (error) throw new Error("Não deu para curtir agora.");
  const { data } = await supabase.from("projects").select("likes_count").eq("id", projectId).single();
  revalidatePath(path);
  return { liked: !existing, count: data?.likes_count ?? 0 };
}

/** toneWarning: pode soar ríspido. O formulário oferece revisar ou publicar assim mesmo (confirmTone). */
export async function addComment(
  projectId: string,
  body: string,
  parentId: string | null,
  rawPath: string,
  confirmTone = false,
): Promise<{ error?: "empty" | "tooLong" | "unknown"; toneWarning?: true }> {
  const path = projectPath(rawPath);
  await requireViewer(path);
  const text = body.trim();
  if (!text) return { error: "empty" };
  if (text.length > COMMENT_MAX) return { error: "tooLong" };
  if (!confirmTone && (await checkTone(text)).flagged) return { toneWarning: true };
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({ target_type: "project", target_id: projectId, parent_id: parentId, body_md: text });
  if (error) return { error: "unknown" };
  revalidatePath(path);
  return {};
}

export async function deleteComment(id: string, rawPath: string): Promise<{ error?: "unknown" }> {
  const path = projectPath(rawPath);
  await requireViewer(path);
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) return { error: "unknown" };
  revalidatePath(path);
  return {};
}
