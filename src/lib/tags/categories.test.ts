import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TAG_CATEGORIES, categoryOf, groupTagsByCategory } from "./categories";

const seed = readFileSync(
  "supabase/migrations/20261123000800_seed_tags.sql",
  "utf8",
);
const seedSlugs = [...seed.matchAll(/^\s*\('([^']+)',/gm)].map((m) => m[1]);

describe("categorias de assuntos", () => {
  it("toda tag inicial tem categoria (nenhuma cai em Outros)", () => {
    expect(seedSlugs.length).toBe(48);
    expect(seedSlugs.filter((s) => categoryOf(s) === "outros")).toEqual([]);
  });

  it("nenhuma tag aparece em duas categorias", () => {
    const all = TAG_CATEGORIES.flatMap((c) => c.slugs);
    expect(new Set(all).size).toBe(all.length);
  });

  it("tag criada por usuário cai em Outros", () => {
    expect(categoryOf("htmx")).toBe("outros");
  });

  it("agrupa na ordem das categorias, mantém a ordem recebida dentro do grupo e pula grupos vazios", () => {
    const tags = [
      { slug: "vue", name: "Vue" },
      { slug: "htmx", name: "htmx" },
      { slug: "python", name: "Python" },
      { slug: "react", name: "React" },
    ];
    expect(groupTagsByCategory(tags)).toEqual([
      { id: "linguagens", tags: [{ slug: "python", name: "Python" }] },
      {
        id: "frontend",
        tags: [
          { slug: "vue", name: "Vue" },
          { slug: "react", name: "React" },
        ],
      },
      { id: "outros", tags: [{ slug: "htmx", name: "htmx" }] },
    ]);
  });
});
