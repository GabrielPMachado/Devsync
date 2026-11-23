"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/safe-next";
import { getViewer } from "@/lib/auth/viewer";
import { COMMENT_MAX, validateProject, type ProjectErrors, type ProjectInput } from "@/lib/projects/rules";
import { createClient } from "@/lib/supabase/server";

async function requireViewer(path: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(safeNext(path, "/projetos"))}`);
  return viewer;
}

export type PublishResult = { error: "invalid"; errors: ProjectErrors } | { error: "demo" | "unknown" };

/** Cria o projeto depois que a demo validou e abre a página dele. */
export async function publishProject(input: ProjectInput & { demoId: string }): Promise<PublishResult> {
  await requireViewer("/projetos/novo");
  const check = validateProject(input);
  if (!check.ok) return { error: "invalid", errors: check.errors };
  const v = check.value;

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ title: v.title, description_md: v.description, repo_url: v.repoUrl || null, site_url: v.siteUrl || null, demo_id: input.demoId })
    .select("id, slug")
    .single();
  if (error?.code === "42501") return { error: "demo" };
  if (error || !project) return { error: "unknown" };

  const { data: tags } = await supabase.from("tags").select("id").in("slug", v.tags);
  const rows = (tags ?? []).map((t: { id: string }) => ({ project_id: project.id, tag_id: t.id }));
  if (rows.length > 0) await supabase.from("project_tags").insert(rows);

  revalidatePath("/projetos");
  redirect(`/projetos/${project.slug}?publicado=1`);
}

/** Curte ou descurte. Devolve o estado novo e o contador do banco. */
export async function toggleLike(projectId: string, path: string): Promise<{ liked: boolean; count: number }> {
  const viewer = await requireViewer(path);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("likes").select("project_id").eq("project_id", projectId).eq("profile_id", viewer.id).maybeSingle();
  if (existing) await supabase.from("likes").delete().eq("project_id", projectId).eq("profile_id", viewer.id);
  else await supabase.from("likes").insert({ project_id: projectId });
  const { data } = await supabase.from("projects").select("likes_count").eq("id", projectId).single();
  revalidatePath(path);
  return { liked: !existing, count: data?.likes_count ?? 0 };
}

export async function addComment(projectId: string, body: string, parentId: string | null, path: string): Promise<{ error?: "empty" | "tooLong" | "unknown" }> {
  await requireViewer(path);
  const text = body.trim();
  if (!text) return { error: "empty" };
  if (text.length > COMMENT_MAX) return { error: "tooLong" };
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({ target_type: "project", target_id: projectId, parent_id: parentId, body_md: text });
  if (error) return { error: "unknown" };
  revalidatePath(path);
  return {};
}

export async function deleteComment(id: string, path: string): Promise<{ error?: "unknown" }> {
  await requireViewer(path);
  const supabase = await createClient();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) return { error: "unknown" };
  revalidatePath(path);
  return {};
}
