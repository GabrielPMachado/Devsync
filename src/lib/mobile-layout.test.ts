// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Proteção contra a página "encolhida" no celular.
 *
 * Uma grade (`grid`) que só define colunas a partir de um tamanho de tela (`sm:`, `md:`, `lg:`)
 * fica, no celular, com uma coluna implícita `auto`. Essa coluna cresce até caber o maior
 * conteúdo sem quebra (um texto com `truncate`, um bloco de código, uma lista de tags) e a página
 * passa a ser mais larga que a tela. O Safari do iPhone então reduz o zoom da página inteira.
 *
 * Toda grade responsiva precisa dizer as colunas do celular também, por exemplo `grid-cols-1`
 * (no Tailwind 4 é `minmax(0, 1fr)`: a coluna nunca passa da largura da tela).
 */
const SRC = join(__dirname, "..");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(path);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [path] : [];
  });
}

/** Grades com colunas só a partir de um tamanho de tela, sem colunas no celular. */
export function gridsWithoutMobileColumns(source: string): string[] {
  const classLists = source.match(/className=\{?["`][^"`]*["`]/g) ?? [];
  return classLists.filter((list) => {
    const classes = list.replace(/^className=\{?["`]|["`]$/g, "").split(/\s+/);
    if (!classes.includes("grid")) return false;
    const responsive = classes.some((c) => /^[a-z0-9-]+:grid-cols-/.test(c));
    const base = classes.some((c) => c.startsWith("grid-cols-"));
    return responsive && !base;
  });
}

describe("layout no celular", () => {
  it("acha a grade que estourava a tela de publicar projeto", () => {
    expect(gridsWithoutMobileColumns('<main className="mx-auto grid gap-8 lg:grid-cols-[minmax(0,760px)_1fr]">')).toHaveLength(1);
    expect(gridsWithoutMobileColumns('<main className="mx-auto grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,760px)_1fr]">')).toHaveLength(0);
    expect(gridsWithoutMobileColumns('<div className="flex gap-2 md:flex-row">')).toHaveLength(0);
  });

  it("toda grade responsiva define as colunas do celular", () => {
    const problems = tsxFiles(SRC).flatMap((file) =>
      gridsWithoutMobileColumns(readFileSync(file, "utf8")).map((list) => `${relative(SRC, file)}: ${list}`),
    );
    expect(problems).toEqual([]);
  });
});
