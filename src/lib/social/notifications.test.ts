import { describe, expect, it } from "vitest";
import { filterFor, groupNotifications, type NotificationRow } from "./notifications";

const actor = (username: string) => ({ username, displayName: username.toUpperCase(), avatarUrl: null });
let n = 0;
function row(p: Partial<NotificationRow>): NotificationRow {
  n += 1;
  return { id: `n${n}`, type: "like", actor: actor("ana"), targetType: "project", targetId: "p1", readAt: null, createdAt: `2026-11-24T10:${String(60 - n).padStart(2, "0")}:00Z`, ...p };
}

describe("groupNotifications", () => {
  it("junta curtidas não lidas do mesmo alvo, com a mais nova à frente", () => {
    const rows = [row({ actor: actor("ana") }), row({ actor: actor("bia") }), row({ actor: actor("caio") })];
    const groups = groupNotifications(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].actors.map((a) => a.username)).toEqual(["ana", "bia", "caio"]);
    expect(groups[0].ids).toEqual(rows.map((r) => r.id));
    expect(groups[0].unread).toBe(true);
    expect(groups[0].createdAt).toBe(rows[0].createdAt);
  });

  it("não junta lidas com não lidas, nem alvos diferentes", () => {
    const groups = groupNotifications([row({}), row({ readAt: "2026-11-24T11:00:00Z" }), row({ targetId: "p2" })]);
    expect(groups).toHaveLength(3);
  });

  it("votos agrupam, mas seguidores, comentários e respostas nunca", () => {
    const groups = groupNotifications([
      row({ type: "vote", targetType: "answer", targetId: "a1" }),
      row({ type: "vote", targetType: "answer", targetId: "a1", actor: actor("bia") }),
      row({ type: "follow", targetType: "profile", targetId: "u1" }),
      row({ type: "follow", targetType: "profile", targetId: "u1", actor: actor("bia") }),
      row({ type: "comment", targetType: "comment", targetId: "c1" }),
      row({ type: "comment", targetType: "comment", targetId: "c1" }),
    ]);
    expect(groups.map((g) => [g.type, g.actors.length])).toEqual([["vote", 2], ["follow", 1], ["follow", 1], ["comment", 1], ["comment", 1]]);
  });

  it("não repete a mesma pessoa no grupo", () => {
    const groups = groupNotifications([row({}), row({})]);
    expect(groups[0].actors).toHaveLength(1);
    expect(groups[0].ids).toHaveLength(2);
  });
});

describe("filterFor", () => {
  it("mapeia as abas para os tipos", () => {
    expect(filterFor("todas")).toBeNull();
    expect(filterFor("respostas")).toEqual(["answer", "accepted", "comment", "reply"]);
    expect(filterFor("seguidores")).toEqual(["follow"]);
    expect(filterFor("qualquer")).toBeNull();
  });
});
