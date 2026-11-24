import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, ACCENTS, BANNER_PRESETS, FRAMES, FREE_FRAMES, STATUSES, isAccent, isBannerPreset, isFrameKey, isStatus } from "./profile-style";

describe("catálogo do perfil", () => {
  it("tem as chaves do design (espelhadas no banco)", () => {
    expect(STATUSES).toEqual(["open_to_work", "building", "learning", "mentoring", "freelance"]);
    expect(BANNER_PRESETS).toEqual(["aurora", "circuito", "grade", "ondas", "noite", "hex"]);
    expect(ACCENTS).toEqual(["azul", "ciano", "violeta", "verde", "ambar", "rosa"]);
    expect(FRAMES.map((f) => f.key)).toEqual(["azul", "ciano", "gradiente", "neutra", "neon", "colchetes", "dourada"]);
    expect(FREE_FRAMES).toEqual(["azul", "ciano", "gradiente", "neutra"]);
    expect(FRAMES.filter((f) => f.requiresBadge).map((f) => [f.key, f.requiresBadge])).toEqual([
      ["neon", "mentor"],
      ["colchetes", "builder"],
      ["dourada", "founder"],
    ]);
    for (const a of ACCENTS) expect(ACCENT_COLORS[a]).toMatch(/^#[0-9A-F]{6}$/);
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
