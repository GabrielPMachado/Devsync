import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import type { CommentAuthor, CommentRow } from "@/lib/comments/tree";
import type { DemoKind, DemoStatus } from "@/lib/demos/url";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { githubLogin } from "./github";

export type ProjectDemo = {
  id: string;
  kind: DemoKind;
  status: DemoStatus;
  url: string | null;
  version: number;
  /** Print automático da demo (serviço de demos), usado no card quando não há capa. */
  screenshotUrl?: string | null;
};

export type ProjectCardData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  author: CommentAuthor;
  tags: string[];
  demo: ProjectDemo | null;
  /** Capa enviada pelo autor (Storage, 16:9). */
  coverUrl?: string | null;
};

export type ProjectPageData = ProjectCardData & { authorId: string; repoUrl: string | null; siteUrl: string | null; updatedAt: string };

export const PROJECT_CARD_FIELDS = `id, slug, title, description_md, likes_count, comments_count, created_at, updated_at, author_id, repo_url, site_url, cover_url,
  author:profiles!projects_author_id_fkey(username, display_name, avatar_url),
  demo:demos(id, kind, status, url, version, screenshot_url),
  project_tags(tags(slug))`;

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  description_md: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  author_id: string;
  repo_url: string | null;
  site_url: string | null;
  cover_url: string | null;
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  demo: (Omit<ProjectDemo, "screenshotUrl"> & { screenshot_url: string | null }) | null;
  project_tags: { tags: { slug: string } | null }[];
};

export function toPage(r: ProjectRow): ProjectPageData {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description_md,
    likesCount: r.likes_count,
    commentsCount: r.comments_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorId: r.author_id,
    repoUrl: r.repo_url,
    siteUrl: r.site_url,
    author: { username: r.author?.username ?? null, displayName: r.author?.display_name ?? null, avatarUrl: r.author?.avatar_url ?? null },
    demo: r.demo
      ? { id: r.demo.id, kind: r.demo.kind, status: r.demo.status, url: r.demo.url, version: r.demo.version, screenshotUrl: r.demo.screenshot_url }
      : null,
    coverUrl: r.cover_url,
    tags: r.project_tags.map((t) => t.tags?.slug).filter((s): s is string => !!s),
  };
}

async function client() {
  if (!getSupabaseEnv()) return null;
  await connection();
  return createClient();
}

/** Projetos mais novos primeiro. A RLS esconde os ocultos pela moderação. */
export async function listProjects(limit = 30): Promise<ProjectCardData[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data, error } = await supabase.from("projects").select(PROJECT_CARD_FIELDS).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Falha ao listar projetos: ${error.message}`);
  return ((data ?? []) as unknown as ProjectRow[]).map(toPage);
}

/** Memorizada por pedido: a página e o generateMetadata leem o mesmo projeto. */
export const getProject = cache(async (slug: string): Promise<ProjectPageData | null> => {
  const supabase = await client();
  if (!supabase) return null;
  const { data, error } = await supabase.from("projects").select(PROJECT_CARD_FIELDS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Falha ao ler o projeto: ${error.message}`);
  return data ? toPage(data as unknown as ProjectRow) : null;
});

export async function getComments(projectId: string): Promise<CommentRow[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("comments")
    .select("id, parent_id, body_md, created_at, author_id, author:profiles!comments_author_id_fkey(username, display_name, avatar_url)")
    .eq("target_type", "project")
    .eq("target_id", projectId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Falha ao ler os comentários: ${error.message}`);
  type C = { id: string; parent_id: string | null; body_md: string; created_at: string; author_id: string; author: ProjectRow["author"] };
  return ((data ?? []) as unknown as C[]).map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    bodyMd: c.body_md,
    createdAt: c.created_at,
    authorId: c.author_id,
    author: { username: c.author?.username ?? null, displayName: c.author?.display_name ?? null, avatarUrl: c.author?.avatar_url ?? null },
  }));
}

export async function hasLiked(projectId: string, viewerId: string): Promise<boolean> {
  const supabase = await client();
  if (!supabase) return false;
  const { data } = await supabase.from("likes").select("project_id").eq("project_id", projectId).eq("profile_id", viewerId).maybeSingle();
  return !!data;
}

export async function listTags(): Promise<{ slug: string; name: string }[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("tags").select("slug, name").order("slug").limit(300);
  return data ?? [];
}

/** Usuário do GitHub de quem está publicando (perfil ou login com GitHub), para importar projeto. */
export async function getGithubLogin(): Promise<string | null> {
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("links").eq("id", claims.sub).maybeSingle();
  return githubLogin(profile?.links, claims as Parameters<typeof githubLogin>[1]);
}
