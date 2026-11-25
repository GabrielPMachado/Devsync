import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, ACCENT_MOTION, ACCENT_UNLOCKS, ACCENTS, BANNER_PRESETS, FRAMES, FREE_ACCENTS, FREE_BANNERS, FREE_FRAMES, STATUSES, isAccent, isBannerPreset, isFrameKey, isStatus } from "./profile-style";

describe("catálogo do perfil", () => {
  it("espelha as checagens do banco", () => {
    const sql = readFileSync("supabase/migrations/20261125300000_profile_catalog_v3.sql", "utf8");
    const list = (col: string) => sql.match(new RegExp(`profiles_${col}_check check \\(${col} in \\(([^)]+)\\)`))![1].match(/'([a-z_]+)'/g)!.map((x) => x.slice(1, -1));
    expect(list("banner_preset")).toEqual([...BANNER_PRESETS]);
    expect([...list("accent")].sort()).toEqual([...ACCENTS].sort());
  });

  it("tem as quantidades do catálogo", () => {
    expect(STATUSES).toEqual(["open_to_work", "building", "learning", "mentoring", "freelance"]);
    expect(BANNER_PRESETS).toHaveLength(28);
    expect(ACCENTS).toHaveLength(24);
    expect(FRAMES).toHaveLength(36);
    expect(FREE_FRAMES).toHaveLength(9);
    expect(FREE_BANNERS).toHaveLength(14);
    expect(FREE_ACCENTS).toHaveLength(12);
    expect(new Set(FRAMES.map((f) => f.key)).size).toBe(FRAMES.length);
    for (const a of ACCENTS) expect(ACCENT_COLORS[a]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("toda cor nova é animada, e o ciclo começa na cor parada", () => {
    for (const a of Object.keys(ACCENT_UNLOCKS) as (keyof typeof ACCENT_MOTION)[]) {
      const m = ACCENT_MOTION[a]!;
      expect(m, a).toBeTruthy();
      expect(m.stops[0]).toBe(ACCENT_COLORS[a]);
      expect(m.stops.length).toBeGreaterThanOrEqual(2);
      for (const c of m.stops) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    }
    const rhythms = Object.values(ACCENT_MOTION).map((m) => `${m!.stops.join()}-${m!.seconds}`);
    expect(new Set(rhythms).size).toBe(rhythms.length);
  });

  it("guardas de tipo recusam o que não está na lista", () => {
    expect(isStatus("building")).toBe(true);
    expect(isStatus("dormindo")).toBe(false);
    expect(isBannerPreset("hex")).toBe(true);
    expect(isBannerPreset("toString")).toBe(false);
    expect(isAccent("rosa")).toBe(true);
    expect(isAccent("preto")).toBe(false);
    expect(isFrameKey("neon")).toBe(true);
    expect(isFrameKey("arco_iris")).toBe(false);
  });
});
