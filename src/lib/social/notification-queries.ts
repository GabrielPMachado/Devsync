import "server-only";
import { cache } from "react";
import { excerptOf } from "@/lib/studies/queries";
import { filterFor, groupNotifications, type Actor, type NotificationGroup, type NotificationRow, type NotificationTarget } from "./notifications";
import { client } from "./queries";

/** O que a notificação aponta: título e endereço. null quando o alvo sumiu (apagado ou oculto). */
export type NotificationTargetInfo = { title: string; href: string; quote: string | null } | null;
export type NotificationView = NotificationGroup & { target: NotificationTargetInfo };

const LIMIT = 100;

type ActorRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;

function toActor(a: ActorRow): Actor | null {
  return a ? { id: a.id, username: a.username, displayName: a.display_name, avatarUrl: a.avatar_url } : null;
}

/** Memorizada por pedido: o sino e a aba do celular leem o mesmo número. */
export const unreadCount = cache(async (viewerId: string): Promise<number> => {
  const supabase = await client();
  if (!supabase) return 0;
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", viewerId).is("read_at", null);
  return count ?? 0;
});

/** Notificações da pessoa (até 100), agrupadas e com o alvo resolvido. */
export async function loadNotifications(viewerId: string, tab: string): Promise<NotificationView[]> {
  const supabase = await client();
  if (!supabase) return [];
  let query = supabase
    .from("notifications")
    .select("id, type, target_type, target_id, read_at, created_at, badge, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)")
    .eq("recipient_id", viewerId);
  const types = filterFor(tab);
  if (types) query = query.in("type", types);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(LIMIT);
  if (error) throw new Error(`Falha ao ler as notificações: ${error.message}`);

  type R = { id: string; type: NotificationRow["type"]; target_type: NotificationTarget; target_id: string; read_at: string | null; created_at: string; badge: string | null; actor: ActorRow };
  const rows: NotificationRow[] = ((data ?? []) as unknown as R[]).map((r) => ({
    id: r.id,
    type: r.type,
    actor: toActor(r.actor),
    targetType: r.target_type,
    targetId: r.target_id,
    readAt: r.read_at,
    createdAt: r.created_at,
    badge: r.badge,
  }));
  const groups = groupNotifications(rows);
  const targets = await resolveTargets(groups);
  // Insígnia: o "título" é a chave (a tela traduz) e o link leva à seção de insígnias.
  return groups.map((g) => ({
    ...g,
    target: g.type === "badge" ? (g.badge ? { title: g.badge, href: "/configuracoes#insignias", quote: null } : null) : (targets.get(`${g.targetType}:${g.targetId}`) ?? null),
  }));
}

/** Busca títulos e endereços dos alvos, em poucas consultas (uma por tipo de alvo). */
async function resolveTargets(groups: NotificationGroup[]): Promise<Map<string, NotificationTargetInfo>> {
  const supabase = await client();
  const out = new Map<string, NotificationTargetInfo>();
  if (!supabase) return out;
  const ids = (type: NotificationTarget) => [...new Set(groups.filter((g) => g.targetType === type).map((g) => g.targetId))];

  // Comentários apontam para um projeto, pergunta ou resposta: resolve isso primeiro.
  const commentIds = ids("comment");
  type C = { id: string; target_type: "project" | "question" | "answer"; target_id: string; body_md: string };
  const comments = commentIds.length ? (((await supabase.from("comments").select("id, target_type, target_id, body_md").in("id", commentIds)).data ?? []) as C[]) : [];

  const projectIds = [...new Set([...ids("project"), ...comments.filter((c) => c.target_type === "project").map((c) => c.target_id)])];
  const questionIds = [...new Set([...ids("question"), ...comments.filter((c) => c.target_type === "question").map((c) => c.target_id)])];
  const answerIds = [...new Set([...ids("answer"), ...comments.filter((c) => c.target_type === "answer").map((c) => c.target_id)])];

  type P = { id: string; slug: string; title: string };
  type A = { id: string; body_md: string; question: P | null };
  const [projects, questions, answers] = await Promise.all([
    projectIds.length ? supabase.from("projects").select("id, slug, title").in("id", projectIds) : Promise.resolve({ data: [] }),
    questionIds.length ? supabase.from("questions").select("id, slug, title").in("id", questionIds) : Promise.resolve({ data: [] }),
    answerIds.length ? supabase.from("answers").select("id, body_md, question:questions!answers_question_id_fkey(id, slug, title)").in("id", answerIds) : Promise.resolve({ data: [] }),
  ]);

  const base = new Map<string, NonNullable<NotificationTargetInfo>>();
  for (const p of (projects.data ?? []) as P[]) base.set(`project:${p.id}`, { title: p.title, href: `/projetos/${p.slug}`, quote: null });
  for (const q of (questions.data ?? []) as P[]) base.set(`question:${q.id}`, { title: q.title, href: `/estudos/${q.slug}`, quote: null });
  for (const a of (answers.data ?? []) as unknown as A[]) {
    if (a.question) base.set(`answer:${a.id}`, { title: a.question.title, href: `/estudos/${a.question.slug}#resposta-${a.id}`, quote: excerptOf(a.body_md, 120) });
  }
  for (const [k, v] of base) out.set(k, v);
  for (const c of comments) {
    const parent = base.get(`${c.target_type}:${c.target_id}`);
    if (parent) out.set(`comment:${c.id}`, { title: parent.title, href: parent.href, quote: excerptOf(c.body_md, 120) });
  }
  // Seguidor: o alvo é o próprio perfil de quem seguiu.
  for (const g of groups) {
    if (g.targetType === "profile" && g.actors[0]?.username) out.set(`profile:${g.targetId}`, { title: g.actors[0].username, href: `/@${g.actors[0].username}`, quote: null });
  }
  return out;
}
