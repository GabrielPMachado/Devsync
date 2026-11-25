import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ACCENTS, ACCENT_COLORS, ACCENT_MOTION, ACCENT_UNLOCKS } from "@/lib/social/profile-style";
import { accentAnimation, accentStyle } from "./accent";

describe("accentStyle", () => {
  it("sem escolha (ou valor estranho), usa o azul", () => {
    expect(accentStyle(null)["--accent"]).toBe(ACCENT_COLORS.azul);
    expect(accentStyle("preto")["--accent"]).toBe(ACCENT_COLORS.azul);
  });

  it("cada cor tem um tom de texto legível no fundo escuro", () => {
    for (const a of ACCENTS.filter((x) => !ACCENT_MOTION[x])) {
      const s = accentStyle(a);
      expect(s["--accent"]).toBe(ACCENT_COLORS[a]);
      expect(s["--accent-text"]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("cor animada: --accent segue --accent-anim, que começa na cor parada e tem keyframe no CSS", () => {
    const css = readFileSync("src/styles/profile-motion.css", "utf8").toLowerCase();
    const media = css.slice(css.indexOf("prefers-reduced-motion: no-preference"));
    for (const a of Object.keys(ACCENT_UNLOCKS) as (keyof typeof ACCENT_MOTION)[]) {
      const s = accentStyle(a);
      expect(s["--accent-anim"]).toBe(ACCENT_COLORS[a]);
      expect(s["--accent"]).toBe("var(--accent-anim)");
      expect(s.animation).toBe(accentAnimation(a));
      expect(s.animation).toContain(`pm-accent-${a} `);
      // A keyframe só existe dentro do bloco de quem aceita movimento, com as mesmas paradas.
      const start = media.indexOf(`@keyframes pm-accent-${a} {`);
      expect(start, a).toBeGreaterThan(0);
      const end = media.indexOf("@keyframes", start + 1);
      const stops = [...media.slice(start, end < 0 ? undefined : end).matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]);
      expect(stops, a).toEqual(ACCENT_MOTION[a]!.stops.map((c) => c.toLowerCase()));
    }
    expect(accentAnimation("azul")).toBeUndefined();
  });
});
