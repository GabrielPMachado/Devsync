import { describe, expect, it } from "vitest";
import { ACCENTS, ACCENT_COLORS } from "@/lib/social/profile-style";
import { accentStyle } from "./accent";

describe("accentStyle", () => {
  it("sem escolha (ou valor estranho), usa o azul", () => {
    expect(accentStyle(null)["--accent"]).toBe(ACCENT_COLORS.azul);
    expect(accentStyle("preto")["--accent"]).toBe(ACCENT_COLORS.azul);
  });

  it("cada cor tem um tom de texto legível no fundo escuro", () => {
    for (const a of ACCENTS) {
      const s = accentStyle(a);
      expect(s["--accent"]).toBe(ACCENT_COLORS[a]);
      expect(s["--accent-text"]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
