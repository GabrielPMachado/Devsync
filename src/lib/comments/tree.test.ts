import { describe, expect, it } from "vitest";
import { buildCommentTree, type CommentRow } from "./tree";

const author = { username: "ana", displayName: "Ana", avatarUrl: null };
const row = (id: string, parentId: string | null, createdAt: string): CommentRow => ({ id, parentId, bodyMd: id, createdAt, authorId: "u1", author });

describe("buildCommentTree", () => {
  it("põe as respostas embaixo do comentário, em ordem de criação", () => {
    const tree = buildCommentTree([row("b", null, "2026-11-23T10:02:00Z"), row("r2", "a", "2026-11-23T10:05:00Z"), row("a", null, "2026-11-23T10:00:00Z"), row("r1", "a", "2026-11-23T10:03:00Z")]);
    expect(tree.map((c) => c.id)).toEqual(["a", "b"]);
    expect(tree[0]!.replies.map((c) => c.id)).toEqual(["r1", "r2"]);
    expect(tree[1]!.replies).toEqual([]);
  });

  it("resposta cujo comentário não veio (oculto) aparece como comentário", () => {
    const tree = buildCommentTree([row("r1", "sumiu", "2026-11-23T10:03:00Z")]);
    expect(tree.map((c) => c.id)).toEqual(["r1"]);
  });
});
