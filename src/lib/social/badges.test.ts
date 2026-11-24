import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BADGE_KEYS, FRAME_UNLOCKS, SHOWN_BADGES_MAX, frameLocked, isBadgeKey, sanitizeShownBadges } from "./badges";

describe("catálogo de insígnias", () => {
  it("espelha o catálogo do banco", () => {
    const sql = readFileSync("supabase/migrations/20261124900000_badges.sql", "utf8");
    const inSql = sql.match(/select array\[([^\]]+)\]/)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
    expect(inSql).toEqual([...BADGE_KEYS]);
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
