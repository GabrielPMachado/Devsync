import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIMITIVES, RADII, SEMANTIC, SPACES, cssColorName } from "./design-tokens";

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function cssVars(prefix: string): Map<string, string> {
  const re = new RegExp(`--${prefix}-([\\w-]+):\\s*([^;]+);`, "g");
  return new Map([...css.matchAll(re)].map((m) => [m[1], m[2].trim()]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hex = (token: keyof typeof SEMANTIC) => PRIMITIVES[SEMANTIC[token]];

describe("tokens do Figma", () => {
  it("todo texto passa no WCAG AA (4,5:1) sobre todo fundo", () => {
    const texts = Object.keys(SEMANTIC).filter(
      (k) => (k.startsWith("text/") && k !== "text/on-brand") || k.endsWith("-text"),
    ) as (keyof typeof SEMANTIC)[];
    const backgrounds = Object.keys(SEMANTIC).filter((k) => k.startsWith("bg/")) as (keyof typeof SEMANTIC)[];
    for (const text of texts) {
      for (const bg of backgrounds) {
        expect(contrast(hex(text), hex(bg)), `${text} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("mantém as cores da marca do Figma", () => {
    expect(PRIMITIVES["blue/600"]).toBe("#2563EB");
    expect(PRIMITIVES["cyan/400"]).toBe("#22D3EE");
    expect(PRIMITIVES["ink/950"]).toBe("#070B14");
  });

  it("todo token semântico aponta para um primitivo existente", () => {
    for (const [name, prim] of Object.entries(SEMANTIC)) {
      expect(PRIMITIVES, `${name} → ${prim}`).toHaveProperty([prim]);
    }
  });

  it("tokens.css tem exatamente as cores do Figma, sem sobras", () => {
    const expected = new Map<string, string>();
    for (const [name, hex] of Object.entries(PRIMITIVES)) expected.set(cssColorName(name), hex);
    for (const [name, prim] of Object.entries(SEMANTIC)) {
      expected.set(cssColorName(name), PRIMITIVES[prim]);
    }
    const actual = new Map([...cssVars("color")].filter(([k]) => !["*", "transparent", "current", "black"].includes(k)));
    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(expected));
  });

  it("tokens.css tem os raios e espaços do Figma", () => {
    const radius = cssVars("radius");
    for (const [name, px] of Object.entries(RADII)) {
      if (name === "none" || name === "full") continue;
      expect(radius.get(name)).toBe(`${px}px`);
    }
    expect(SPACES).toEqual([0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
  });
});
