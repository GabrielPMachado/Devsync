/** Notificações: tipos e agrupamento na leitura ("Ana e mais 4 curtiram"). */

export type NotificationType = "follow" | "comment" | "reply" | "answer" | "accepted" | "like" | "vote" | "detail_request" | "demo_unavailable";
export type NotificationTarget = "profile" | "project" | "question" | "answer" | "comment";
export type Actor = { id?: string; username: string | null; displayName: string | null; avatarUrl: string | null };

export type NotificationRow = {
  id: string;
  type: NotificationType;
  actor: Actor | null;
  targetType: NotificationTarget;
  targetId: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationGroup = {
  key: string;
  type: NotificationType;
  targetType: NotificationTarget;
  targetId: string;
  /** Pessoas distintas, a mais recente primeiro. */
  actors: Actor[];
  unread: boolean;
  /** Data do evento mais novo do grupo. */
  createdAt: string;
  ids: string[];
};

/** Só curtidas e votos viram "Fulano e mais N". */
const GROUPABLE = new Set<NotificationType>(["like", "vote"]);

/** Recebe as linhas na ordem do banco (mais nova primeiro) e devolve os grupos na mesma ordem. */
export function groupNotifications(rows: NotificationRow[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const byKey = new Map<string, NotificationGroup>();
  for (const r of rows) {
    const unread = r.readAt === null;
    const key = GROUPABLE.has(r.type) ? `${r.type}:${r.targetId}:${unread ? "u" : "r"}` : r.id;
    let g = byKey.get(key);
    if (!g) {
      g = { key, type: r.type, targetType: r.targetType, targetId: r.targetId, actors: [], unread, createdAt: r.createdAt, ids: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.ids.push(r.id);
    if (r.actor && !g.actors.some((a) => a.username === r.actor?.username)) g.actors.push(r.actor);
  }
  return groups;
}

export type NotificationTab = "todas" | "respostas" | "seguidores";

export function filterFor(tab: string): NotificationType[] | null {
  if (tab === "respostas") return ["answer", "accepted", "comment", "reply"];
  if (tab === "seguidores") return ["follow"];
  return null;
}
