export type CommentAuthor = { username: string | null; displayName: string | null; avatarUrl: string | null };

export type CommentRow = {
  id: string;
  parentId: string | null;
  bodyMd: string;
  createdAt: string;
  authorId: string;
  author: CommentAuthor;
};

export type CommentNode = CommentRow & { replies: CommentRow[] };

/** Monta os 2 níveis (comentário e respostas). O banco já pendura toda resposta na raiz. */
export function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids = new Set(sorted.map((r) => r.id));
  const roots = new Map<string, CommentNode>();
  for (const r of sorted) if (!r.parentId || !ids.has(r.parentId)) roots.set(r.id, { ...r, replies: [] });
  for (const r of sorted) if (r.parentId && roots.has(r.parentId)) roots.get(r.parentId)!.replies.push(r);
  return [...roots.values()];
}
