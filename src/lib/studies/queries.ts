import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Leituras dos Estudos. Tudo com o cliente do visitante: a RLS decide o que ele
 * vê. Conteúdo oculto pela moderação fica fora das listas até para o autor.
 */

export const PAGE_SIZE = 20;

/** decodeURIComponent que não estoura com URL malformada (%E0%A4%A): null vira 404. */
export function decodeSlug(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export type Author = { username: string | null; displayName: string | null; avatarUrl: string | null };

export type QuestionSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  answersCount: number;
  hasAccepted: boolean;
  createdAt: string;
  author: Author;
  tags: string[];
};

export type QuestionDetail = QuestionSummary & {
  authorId: string;
  bodyMd: string;
  acceptedAnswerId: string | null;
  detailRequestsCount: number;
  duplicateOf: { slug: string; title: string } | null;
  edited: boolean;
};

export type AnswerView = {
  id: string;
  authorId: string;
  bodyMd: string;
  techVersion: string | null;
  score: number;
  outdatedFlags: number;
  createdAt: string;
  author: Author;
  myVote: 1 | -1 | 0;
  flaggedByMe: boolean;
  /** Tem versões anteriores em revisions (updated_at muda até com voto, não serve). */
  edited: boolean;
};

export type ListTab = "recent" | "unanswered" | "following";

type Row = Record<string, unknown>;
type AuthorRow = { username: string | null; display_name: string | null; avatar_url: string | null } | null;

const QUESTION_FIELDS =
  "id, slug, title, body_md, answers_count, accepted_answer_id, created_at, author:profiles!questions_author_id_fkey(username, display_name, avatar_url), question_tags(tags(slug))";

function toAuthor(row: AuthorRow | AuthorRow[]): Author {
  const a = Array.isArray(row) ? row[0] : row;
  return { username: a?.username ?? null, displayName: a?.display_name ?? null, avatarUrl: a?.avatar_url ?? null };
}

function toTags(rows: unknown): string[] {
  // Sem tipos gerados, o embed vem tipado como lista; na prática tags é um objeto.
  return ((rows as { tags: { slug: string } | { slug: string }[] | null }[] | null) ?? [])
    .flatMap((qt) => [qt.tags].flat())
    .flatMap((t) => (t ? [t.slug] : []))
    .sort();
}

/** Primeiras linhas do Markdown, sem a marcação, para o card da lista. */
export function excerptOf(md: string, max = 220): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

function toSummary(row: Row): QuestionSummary {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    excerpt: excerptOf(row.body_md as string),
    answersCount: row.answers_count as number,
    hasAccepted: row.accepted_answer_id != null,
    createdAt: row.created_at as string,
    author: toAuthor(row.author as AuthorRow),
    tags: toTags(row.question_tags),
  };
}

export async function listQuestions({
  tab,
  tag,
  page,
  viewerId,
}: {
  tab: ListTab;
  tag?: string;
  page: number;
  viewerId?: string | null;
}): Promise<{ questions: QuestionSummary[]; hasMore: boolean }> {
  const supabase = await createClient();

  // Filtros por tag usam um segundo embed (!inner) para não cortar as tags mostradas no card.
  let filterTagIds: string[] | null = null;
  if (tab === "following") {
    if (!viewerId) return { questions: [], hasMore: false };
    const { data } = await supabase.from("tag_follows").select("tag_id").eq("profile_id", viewerId);
    filterTagIds = (data ?? []).map((r) => r.tag_id as string);
    if (filterTagIds.length === 0) return { questions: [], hasMore: false };
  }

  const fields = tag || filterTagIds ? `${QUESTION_FIELDS}, filter:question_tags!inner(tag_id, tags!inner(slug))` : QUESTION_FIELDS;
  const limit = PAGE_SIZE * page;
  let query = supabase.from("questions").select(fields).is("hidden_at", null);
  if (tab === "unanswered") query = query.eq("answers_count", 0);
  if (filterTagIds) query = query.in("filter.tag_id", filterTagIds);
  if (tag) query = query.eq("filter.tags.slug", tag);
  const { data } = await query.order("created_at", { ascending: false }).range(0, limit);

  // Um mesmo item pode voltar uma vez por tag que casou com o filtro.
  const seen = new Set<string>();
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => !seen.has(r.id as string) && seen.add(r.id as string));
  return { questions: rows.slice(0, limit).map(toSummary), hasMore: rows.length > limit };
}

export async function getQuestion(slug: string): Promise<QuestionDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select(`${QUESTION_FIELDS}, author_id, detail_requests_count, duplicate_of_id, hidden_at`)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Row;
  if (row.hidden_at) return null;

  const { count: revisionCount } = await supabase
    .from("revisions")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "question")
    .eq("target_id", row.id as string);

  let duplicateOf: QuestionDetail["duplicateOf"] = null;
  if (row.duplicate_of_id) {
    const { data: original } = await supabase.from("questions").select("slug, title").eq("id", row.duplicate_of_id as string).maybeSingle();
    duplicateOf = original ? { slug: original.slug as string, title: original.title as string } : null;
  }

  return {
    ...toSummary(row),
    authorId: row.author_id as string,
    bodyMd: row.body_md as string,
    acceptedAnswerId: (row.accepted_answer_id as string | null) ?? null,
    detailRequestsCount: row.detail_requests_count as number,
    duplicateOf,
    edited: (revisionCount ?? 0) > 0,
  };
}

/** Respostas na ordem da seção 5.4 (answers_ordered), com o que o visitante já fez nelas. */
export async function getAnswers(questionId: string, viewerId: string | null): Promise<AnswerView[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("answers_ordered", { question_id: questionId });
  const answers = ((data ?? []) as Row[]).filter((a) => !a.hidden_at);
  if (answers.length === 0) return [];

  const ids = answers.map((a) => a.id as string);
  const authorIds = [...new Set(answers.map((a) => a.author_id as string))];
  const [{ data: profiles }, { data: revisions }, votes, flags] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds),
    supabase.from("revisions").select("target_id").eq("target_type", "answer").in("target_id", ids),
    viewerId ? supabase.from("answer_votes").select("answer_id, value").eq("profile_id", viewerId).in("answer_id", ids) : null,
    viewerId ? supabase.from("outdated_flags").select("answer_id").eq("profile_id", viewerId).in("answer_id", ids) : null,
  ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as AuthorRow]));
  const myVotes = new Map((votes?.data ?? []).map((v) => [v.answer_id as string, v.value as 1 | -1]));
  const myFlags = new Set((flags?.data ?? []).map((f) => f.answer_id as string));
  const editedIds = new Set((revisions ?? []).map((r) => r.target_id as string));

  return answers.map((a) => ({
    id: a.id as string,
    authorId: a.author_id as string,
    bodyMd: a.body_md as string,
    techVersion: (a.tech_version as string | null) ?? null,
    score: a.score as number,
    outdatedFlags: a.outdated_flags as number,
    createdAt: a.created_at as string,
    author: toAuthor(byId.get(a.author_id as string) ?? null),
    myVote: myVotes.get(a.id as string) ?? 0,
    flaggedByMe: myFlags.has(a.id as string),
    edited: editedIds.has(a.id as string),
  }));
}

export async function getAnswer(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("answers").select("id, question_id, author_id, body_md, tech_version").eq("id", id).maybeSingle();
  return data as { id: string; question_id: string; author_id: string; body_md: string; tech_version: string | null } | null;
}

export async function hasRequestedDetails(questionId: string, viewerId: string | null): Promise<boolean> {
  if (!viewerId) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("detail_requests").select("question_id").eq("question_id", questionId).eq("profile_id", viewerId).maybeSingle();
  return !!data;
}

export type RevisionView = { id: string; title: string | null; bodyMd: string | null; createdAt: string };

/** Versões anteriores, da mais nova para a mais antiga. */
export async function getRevisions(targetType: "question" | "answer", targetId: string): Promise<RevisionView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("revisions")
    .select("id, title, body_md, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id as string, title: (r.title as string | null) ?? null, bodyMd: (r.body_md as string | null) ?? null, createdAt: r.created_at as string }));
}

/** Tags mais usadas para os atalhos da lista. */
export async function popularTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("question_tags").select("tags(slug)").limit(500);
  const counts = new Map<string, number>();
  for (const slug of toTags(data)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([slug]) => slug);
}
