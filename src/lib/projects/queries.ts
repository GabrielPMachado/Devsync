import "server-only";
import { connection } from "next/server";
import type { CommentAuthor, CommentRow } from "@/lib/comments/tree";
import type { DemoKind, DemoStatus } from "@/lib/demos/url";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type ProjectDemo = { id: string; kind: DemoKind; status: DemoStatus; url: string | null; version: number };

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
};

export type ProjectPageData = ProjectCardData & { authorId: string; repoUrl: string | null; siteUrl: string | null; updatedAt: string };

const CARD = `id, slug, title, description_md, likes_count, comments_count, created_at, updated_at, author_id, repo_url, site_url,
  author:profiles(username, display_name, avatar_url),
  demo:demos(id, kind, status, url, version),
  project_tags(tags(slug))`;

type Row = {
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
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  demo: ProjectDemo | null;
  project_tags: { tags: { slug: string } | null }[];
};

function toPage(r: Row): ProjectPageData {
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
    demo: r.demo,
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
  const { data } = await supabase.from("projects").select(CARD).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as Row[]).map(toPage);
}

export async function getProject(slug: string): Promise<ProjectPageData | null> {
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.from("projects").select(CARD).eq("slug", slug).maybeSingle();
  return data ? toPage(data as unknown as Row) : null;
}

export async function getComments(projectId: string): Promise<CommentRow[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("comments")
    .select("id, parent_id, body_md, created_at, author_id, author:profiles(username, display_name, avatar_url)")
    .eq("target_type", "project")
    .eq("target_id", projectId)
    .order("created_at", { ascending: true })
    .limit(500);
  type C = { id: string; parent_id: string | null; body_md: string; created_at: string; author_id: string; author: Row["author"] };
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
