import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BADGE_GROUPS, BADGE_KEYS, FRAME_UNLOCKS, SHOWN_BADGES_MAX, frameLocked, isBadgeKey, sanitizeShownBadges } from "./badges";

describe("catálogo de insígnias", () => {
  it("espelha o catálogo do banco", () => {
    const sql = readFileSync("supabase/migrations/20261125150000_profile_catalog_v2.sql", "utf8");
    const inSql = sql.match(/select array\[([^\]]+)\]/)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
    expect(inSql).toEqual([...BADGE_KEYS]);
    expect(BADGE_KEYS).toHaveLength(15);
    expect(BADGE_GROUPS.flatMap((g) => g.badges).sort()).toEqual([...BADGE_KEYS].sort());
    const unlocks = [...sql.matchAll(/when '([a-z_]+)' then '([a-z_]+)'/g)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(unlocks)).toEqual(FRAME_UNLOCKS);
    for (const [frame, badge] of Object.entries(FRAME_UNLOCKS)) {
      expect(sql).toContain(`when '${frame}' then '${badge}'`);
    }
  });

  it("reconhece chaves válidas", () => {
    expect(isBadgeKey("mentor")).toBe(true);
    expect(isBadgeKey("hacker")).toBe(false);
  });

  it("limpa as exibidas: só conquistadas, sem repetir, no máximo 3, na ordem escolhida", () => {
    const earned = ["founder", "curious", "popular", "mentor"];
    expect(sanitizeShownBadges(["mentor", "builder", "mentor", "curious", "x", "popular", "founder"], earned)).toEqual(["mentor", "curious", "popular"]);
    expect(SHOWN_BADGES_MAX).toBe(3);
  });

  it("borda bloqueada até ganhar a insígnia; livres nunca", () => {
    expect(frameLocked("neon", [])).toBe(true);
    expect(frameLocked("neon", ["mentor"])).toBe(false);
    expect(frameLocked("ciano", [])).toBe(false);
    expect(frameLocked(null, [])).toBe(false);
  });
});

describe("bordas por conquista", () => {
  it("as nove bordas bloqueadas vêm do catálogo de aparência, cada uma com sua insígnia", () => {
    expect(Object.keys(FRAME_UNLOCKS)).toHaveLength(9);
    expect(new Set(Object.values(FRAME_UNLOCKS)).size).toBe(9);
    expect(FRAME_UNLOCKS).toMatchObject({ neon: "mentor", colchetes: "builder", dourada: "founder" });
  });
});

describe("toBadges", () => {
  it("lê as linhas do banco e só deixa exibir o que foi conquistado", async () => {
    const { toBadges } = await import("./badges");
    const r = toBadges(["mentor", "curious", "x"], [
      { badge: "curious", awarded_at: "2026-11-24T10:00:00Z" },
      { badge: "velha", awarded_at: "2026-11-24T10:00:00Z" },
    ]);
    expect(r).toEqual({ shownBadges: ["curious"], badges: [{ badge: "curious", awardedAt: "2026-11-24T10:00:00Z" }] });
    expect(toBadges(null, null)).toEqual({ shownBadges: [], badges: [] });
  });
});
