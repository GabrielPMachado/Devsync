import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCENT_UNLOCKS, BANNER_UNLOCKS } from "./profile-style";
import { ANIMATED_BADGES, BADGE_GROUPS, BADGE_KEYS, FRAME_UNLOCKS, SHOWN_BADGES_MAX, accentRequiredBadge, bannerRequiredBadge, frameLocked, isBadgeKey, sanitizeShownBadges } from "./badges";

/** Pares "item -> insígnia" de uma função "case" do banco. */
function sqlCase(sql: string, fn: string) {
  const body = sql.split(`function public.${fn}(`)[1].split("end\n$$")[0];
  return Object.fromEntries([...body.matchAll(/when '([a-z_]+)' then '([a-z_]+)'/g)].map((m) => [m[1], m[2]]));
}

describe("catálogo de insígnias", () => {
  it("espelha o catálogo do banco", () => {
    const sql = readFileSync("supabase/migrations/20261125300000_profile_catalog_v3.sql", "utf8");
    const inSql = sql.match(/select array\[([^\]]+)\]/)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
    expect(inSql).toEqual([...BADGE_KEYS]);
    expect(BADGE_KEYS).toHaveLength(30);
    expect(BADGE_GROUPS.flatMap((g) => g.badges).sort()).toEqual([...BADGE_KEYS].sort());
    expect(sqlCase(sql, "frame_required_badge")).toEqual(FRAME_UNLOCKS);
    expect(sqlCase(sql, "banner_required_badge")).toEqual(BANNER_UNLOCKS);
    expect(sqlCase(sql, "accent_required_badge")).toEqual(ACCENT_UNLOCKS);
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

describe("itens por conquista", () => {
  it("27 bordas bloqueadas, cada uma ligada a uma insígnia que existe", () => {
    expect(Object.keys(FRAME_UNLOCKS)).toHaveLength(27);
    expect(FRAME_UNLOCKS).toMatchObject({ neon: "mentor", colchetes: "builder", dourada: "founder", lendaria: "legend" });
    for (const b of Object.values(FRAME_UNLOCKS)) expect(isBadgeKey(b), b).toBe(true);
  });

  it("os 14 banners e as 12 cores novas são por conquista; os antigos continuam livres", () => {
    expect(Object.keys(BANNER_UNLOCKS)).toHaveLength(14);
    expect(Object.keys(ACCENT_UNLOCKS)).toHaveLength(12);
    for (const b of [...Object.values(BANNER_UNLOCKS), ...Object.values(ACCENT_UNLOCKS)]) expect(isBadgeKey(b), b).toBe(true);
    expect(bannerRequiredBadge("hiperespaco")).toBe("icon");
    expect(bannerRequiredBadge("aurora")).toBeNull();
    expect(accentRequiredBadge("retro")).toBe("founder");
    expect(accentRequiredBadge("azul")).toBeNull();
    expect(accentRequiredBadge(null)).toBeNull();
  });

  it("toda insígnia nova libera ao menos um item e tem ícone animado", () => {
    expect(ANIMATED_BADGES).toHaveLength(15);
    const unlocks = new Set([...Object.values(FRAME_UNLOCKS), ...Object.values(BANNER_UNLOCKS), ...Object.values(ACCENT_UNLOCKS)]);
    for (const b of ANIMATED_BADGES) {
      expect(isBadgeKey(b), b).toBe(true);
      expect(unlocks.has(b as never), b).toBe(true);
    }
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
