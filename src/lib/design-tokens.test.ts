import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIMITIVES, RADII, SEMANTIC, SPACES, cssColorName } from "./design-tokens";

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function cssVars(prefix: string): Map<string, string> {
  const re = new RegExp(`--${prefix}-([\\w-]+):\\s*([^;]+);`, "g");
  return new Map([...css.matchAll(re)].map((m) => [m[1], m[2].trim()]));
}

describe("tokens do Figma", () => {
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
    const actual = new Map([...cssVars("color")].filter(([k]) => !["*", "transparent", "current"].includes(k)));
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
