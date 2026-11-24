import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { normalizeUsername } from "@/lib/auth/username";
import { getSupabaseEnv } from "@/lib/env";
import { PROJECT_CARD_FIELDS, toPage, type ProjectCardData, type ProjectRow } from "@/lib/projects/queries";
import { QUESTION_FIELDS, toSummary, type QuestionSummary } from "@/lib/studies/queries";
import { createClient } from "@/lib/supabase/server";
import { isAccent, isBannerPreset, isStatus, type Accent, type BannerPreset, type ProfileStatus } from "./profile-style";

/**
 * Leituras da parte social e da descoberta. Sempre com o cliente de quem está
 * vendo: a RLS decide o que aparece.
 */

export type Person = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

export type ProfileLinks = { github?: string; site?: string; linkedin?: string; x?: string; youtube?: string };

export type ProfileData = Person & {
  links: ProfileLinks;
  headline: string | null;
  location: string | null;
  status: ProfileStatus | null;
  bannerUrl: string | null;
  bannerPreset: BannerPreset | null;
  avatarFrame: string | null;
  accent: Accent | null;
  followersCount: number;
  followingCount: number;
  createdAt: string;
  tags: string[];
};

export type ProfileStats = { projects: number; questions: number; answers: number; accepted: number };

export type ProfileAnswer = { id: string; score: number; createdAt: string; accepted: boolean; question: { slug: string; title: string } };

export type FeedItem = { kind: "project"; at: string; project: ProjectCardData } | { kind: "question"; at: string; question: QuestionSummary };

const PERSON_FIELDS = "id, username, display_name, avatar_url, bio";
type PersonRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null };

export async function client() {
  if (!getSupabaseEnv()) return null;
  await connection();
  return createClient();
}

function toPerson(r: PersonRow): Person {
  return { id: r.id, username: r.username ?? "", displayName: r.display_name, avatarUrl: r.avatar_url, bio: r.bio };
}

/** Lê os links guardados em profiles.links, ignorando o que não for texto. */
export function toLinks(raw: unknown): ProfileLinks {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const links: ProfileLinks = {};
  if (typeof o.github === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(o.github)) links.github = o.github;
  if (typeof o.site === "string" && /^https:\/\//.test(o.site)) links.site = o.site;
  if (typeof o.linkedin === "string" && /^[A-Za-z0-9_%-]{3,100}$/.test(o.linkedin)) links.linkedin = o.linkedin;
  if (typeof o.x === "string" && /^[A-Za-z0-9_]{1,15}$/.test(o.x)) links.x = o.x;
  if (typeof o.youtube === "string" && /^[A-Za-z0-9._-]{3,30}$/.test(o.youtube)) links.youtube = o.youtube;
  return links;
}

/** Perfil pelo @ (memorizado por pedido: página e metadados leem o mesmo). */
export const getProfile = cache(async (raw: string): Promise<ProfileData | null> => {
  const supabase = await client();
  if (!supabase) return null;
  let username: string;
  try {
    username = normalizeUsername(decodeURIComponent(raw));
  } catch {
    return null;
  }
  const { data } = await supabase
    .from("profiles")
    .select(`${PERSON_FIELDS}, links, headline, location, status, banner_url, banner_preset, avatar_frame, accent, followers_count, following_count, created_at, profile_tags(tags(slug))`)
    .eq("username", username)
    .maybeSingle();
  if (!data?.username) return null;
  const tags = ((data.profile_tags ?? []) as unknown as { tags: { slug: string } | null }[])
    .flatMap((pt) => [pt.tags].flat())
    .flatMap((t) => (t ? [t.slug] : []))
    .sort();
  return {
    ...toPerson(data as PersonRow),
    links: toLinks(data.links),
    headline: data.headline,
    location: data.location,
    status: data.status && isStatus(data.status) ? data.status : null,
    bannerUrl: data.banner_url,
    bannerPreset: data.banner_preset && isBannerPreset(data.banner_preset) ? data.banner_preset : null,
    avatarFrame: data.avatar_frame,
    accent: data.accent && isAccent(data.accent) ? data.accent : null,
    followersCount: data.followers_count,
    followingCount: data.following_count,
    createdAt: data.created_at,
    tags,
  };
});

export async function getProfileStats(profileId: string): Promise<ProfileStats> {
  const supabase = await client();
  if (!supabase) return { projects: 0, questions: 0, answers: 0, accepted: 0 };
  const head = { count: "exact" as const, head: true };
  const [projects, questions, answers, accepted] = await Promise.all([
    supabase.from("projects").select("id", head).eq("author_id", profileId).is("hidden_at", null),
    supabase.from("questions").select("id", head).eq("author_id", profileId).is("hidden_at", null),
    supabase.from("answers").select("id", head).eq("author_id", profileId).is("hidden_at", null),
    supabase
      .from("questions")
      .select("id, accepted:answers!questions_accepted_answer_fk!inner(author_id)", head)
      .eq("accepted.author_id", profileId)
      .is("hidden_at", null),
  ]);
  return { projects: projects.count ?? 0, questions: questions.count ?? 0, answers: answers.count ?? 0, accepted: accepted.count ?? 0 };
}

/** Quais destes perfis quem está vendo já segue. */
export async function followingSet(viewerId: string | null | undefined, ids: string[]): Promise<Set<string>> {
  if (!viewerId || ids.length === 0) return new Set();
  const supabase = await client();
  if (!supabase) return new Set();
  const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", viewerId).in("followee_id", ids);
  return new Set((data ?? []).map((r) => r.followee_id as string));
}

/** Seguidores (who = "followers") ou quem o perfil segue (who = "following"), mais recentes primeiro. */
export async function listConnections(profileId: string, who: "followers" | "following", limit = 100): Promise<Person[]> {
  const supabase = await client();
  if (!supabase) return [];
  const embed = who === "followers" ? "person:profiles!follows_follower_id_fkey" : "person:profiles!follows_followee_id_fkey";
  const { data } = await supabase
    .from("follows")
    .select(`created_at, ${embed}(${PERSON_FIELDS})`)
    .eq(who === "followers" ? "followee_id" : "follower_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as { person: PersonRow | null }[]).flatMap((r) => (r.person?.username ? [toPerson(r.person)] : []));
}

export async function listProjectsBy(authorId: string, limit = 20): Promise<ProjectCardData[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("projects").select(PROJECT_CARD_FIELDS).eq("author_id", authorId).is("hidden_at", null).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as ProjectRow[]).map(toPage);
}

export async function listQuestionsBy(authorId: string, limit = 20): Promise<QuestionSummary[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("questions").select(QUESTION_FIELDS).eq("author_id", authorId).is("hidden_at", null).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toSummary);
}

export async function listAnswersBy(authorId: string, limit = 20): Promise<ProfileAnswer[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("answers")
    .select("id, score, created_at, question:questions!answers_question_id_fkey!inner(slug, title, accepted_answer_id, hidden_at)")
    .eq("author_id", authorId)
    .is("hidden_at", null)
    .is("question.hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  type A = { id: string; score: number; created_at: string; question: { slug: string; title: string; accepted_answer_id: string | null } };
  return ((data ?? []) as unknown as A[]).map((a) => ({
    id: a.id,
    score: a.score,
    createdAt: a.created_at,
    accepted: a.question.accepted_answer_id === a.id,
    question: { slug: a.question.slug, title: a.question.title },
  }));
}

async function projectsByIds(ids: string[]): Promise<Map<string, ProjectCardData>> {
  const supabase = await client();
  if (!supabase || ids.length === 0) return new Map();
  const { data } = await supabase.from("projects").select(PROJECT_CARD_FIELDS).in("id", ids);
  return new Map(((data ?? []) as unknown as ProjectRow[]).map((r) => [r.id, toPage(r)]));
}

async function questionsByIds(ids: string[]): Promise<Map<string, QuestionSummary>> {
  const supabase = await client();
  if (!supabase || ids.length === 0) return new Map();
  const { data } = await supabase.from("questions").select(QUESTION_FIELDS).in("id", ids);
  return new Map(((data ?? []) as unknown as Record<string, unknown>[]).map((r) => [r.id as string, toSummary(r)]));
}

async function peopleByIds(ids: string[]): Promise<Map<string, Person>> {
  const supabase = await client();
  if (!supabase || ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select(PERSON_FIELDS).in("id", ids);
  return new Map(((data ?? []) as PersonRow[]).map((r) => [r.id, toPerson(r)]));
}

export const FEED_PAGE = 20;

/** Uma página do início (home_feed). next = cursor da próxima página, ou null no fim. */
export async function loadFeed(before: string | null): Promise<{ items: FeedItem[]; next: string | null }> {
  const supabase = await client();
  if (!supabase) return { items: [], next: null };
  const { data, error } = await supabase.rpc("home_feed", { before, page_size: FEED_PAGE });
  if (error) throw new Error(`Falha ao montar o feed: ${error.message}`);
  const rows = (data ?? []) as { kind: "project" | "question"; id: string; created_at: string }[];
  const [projects, questions] = await Promise.all([
    projectsByIds(rows.filter((r) => r.kind === "project").map((r) => r.id)),
    questionsByIds(rows.filter((r) => r.kind === "question").map((r) => r.id)),
  ]);
  const items = rows.flatMap((r): FeedItem[] => {
    if (r.kind === "project") {
      const project = projects.get(r.id);
      return project ? [{ kind: "project", at: r.created_at, project }] : [];
    }
    const question = questions.get(r.id);
    return question ? [{ kind: "question", at: r.created_at, question }] : [];
  });
  return { items, next: rows.length === FEED_PAGE ? rows[rows.length - 1].created_at : null };
}

/** Projetos e perguntas mais novos de todo mundo (início de quem não segue nada ainda, e visitantes). */
export async function loadLatest(limit = 10): Promise<FeedItem[]> {
  const supabase = await client();
  if (!supabase) return [];
  const [p, q] = await Promise.all([
    supabase.from("projects").select(PROJECT_CARD_FIELDS).is("hidden_at", null).order("created_at", { ascending: false }).limit(limit),
    supabase.from("questions").select(QUESTION_FIELDS).is("hidden_at", null).order("created_at", { ascending: false }).limit(limit),
  ]);
  const items: FeedItem[] = [
    ...((p.data ?? []) as unknown as ProjectRow[]).map((r) => ({ kind: "project" as const, at: r.created_at, project: toPage(r) })),
    ...((q.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ kind: "question" as const, at: r.created_at as string, question: toSummary(r) })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export async function trendingProjects(limit = 6): Promise<ProjectCardData[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.rpc("trending_projects", { page_size: limit });
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const map = await projectsByIds(ids);
  return ids.flatMap((id) => (map.has(id) ? [map.get(id)!] : []));
}

export async function unansweredQuestions(limit = 5): Promise<QuestionSummary[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("questions").select(QUESTION_FIELDS).is("hidden_at", null).eq("answers_count", 0).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toSummary);
}

export async function suggestedPeople(limit = 5): Promise<Person[]> {
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.rpc("suggested_profiles", { page_size: limit });
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const map = await peopleByIds(ids);
  return ids.flatMap((id) => (map.has(id) ? [map.get(id)!] : []));
}

export async function followedTags(viewerId: string | null | undefined): Promise<string[]> {
  if (!viewerId) return [];
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("tag_follows").select("tags(slug)").eq("profile_id", viewerId);
  return ((data ?? []) as unknown as { tags: { slug: string } | null }[]).flatMap((r) => (r.tags ? [r.tags.slug] : [])).sort();
}

export type SearchResults = { projects: ProjectCardData[]; questions: QuestionSummary[]; people: Person[] };

/** Busca (search_content) já com os dados dos cards, na ordem de relevância. */
export async function search(q: string, kinds: string[] | null, tag: string | null): Promise<SearchResults> {
  const empty = { projects: [], questions: [], people: [] };
  if (!q.trim()) return empty;
  const supabase = await client();
  if (!supabase) return empty;
  const { data, error } = await supabase.rpc("search_content", { q, tag_slugs: tag ? [tag] : null, kinds });
  if (error) return empty;
  const rows = (data ?? []) as { kind: string; id: string }[];
  const ids = (k: string) => rows.filter((r) => r.kind === k).map((r) => r.id);
  const [p, qs, people] = await Promise.all([projectsByIds(ids("project")), questionsByIds(ids("question")), peopleByIds(ids("profile"))]);
  const pick = <T,>(k: string, m: Map<string, T>) => ids(k).flatMap((id) => (m.has(id) ? [m.get(id)!] : []));
  return { projects: pick("project", p), questions: pick("question", qs), people: pick("profile", people).filter((x) => x.username) };
}

export type TagPage = { slug: string; name: string; description: string | null; followed: boolean; projects: ProjectCardData[]; questions: QuestionSummary[] };

export async function getTagPage(slug: string, viewerId: string | null | undefined): Promise<TagPage | null> {
  const supabase = await client();
  if (!supabase) return null;
  const { data: tag } = await supabase.from("tags").select("id, slug, name, description").eq("slug", slug).maybeSingle();
  if (!tag) return null;
  const [p, q, f] = await Promise.all([
    supabase.from("projects").select(`${PROJECT_CARD_FIELDS}, filter:project_tags!inner(tag_id)`).eq("filter.tag_id", tag.id).is("hidden_at", null).order("created_at", { ascending: false }).limit(12),
    supabase.from("questions").select(`${QUESTION_FIELDS}, filter:question_tags!inner(tag_id)`).eq("filter.tag_id", tag.id).is("hidden_at", null).order("created_at", { ascending: false }).limit(20),
    viewerId ? supabase.from("tag_follows").select("tag_id").eq("profile_id", viewerId).eq("tag_id", tag.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    slug: tag.slug,
    name: tag.name,
    description: tag.description,
    followed: !!f.data,
    projects: ((p.data ?? []) as unknown as ProjectRow[]).map(toPage),
    questions: ((q.data ?? []) as unknown as Record<string, unknown>[]).map(toSummary),
  };
}
