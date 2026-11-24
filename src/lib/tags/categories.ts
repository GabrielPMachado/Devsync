/**
 * Categorias dos assuntos (tags). Ficam no código, não no banco: são só uma forma
 * de organizar a lista na tela. Tag criada por usuário cai em "outros" até entrar aqui.
 * O nome de cada categoria vem das mensagens (TagCategories.<id>).
 */
export const TAG_CATEGORIES = [
  {
    id: "linguagens",
    slugs: [
      "javascript",
      "typescript",
      "python",
      "java",
      "c#",
      "c++",
      "go",
      "rust",
      "php",
      "ruby",
      "kotlin",
      "swift",
      "dart",
    ],
  },
  {
    id: "frontend",
    slugs: [
      "frontend",
      "html",
      "css",
      "tailwindcss",
      "react",
      "next.js",
      "vue",
      "angular",
      "svelte",
      "astro",
    ],
  },
  { id: "backend", slugs: ["backend", "node.js", "api", "graphql"] },
  { id: "mobile", slugs: ["mobile", "react-native", "expo", "flutter"] },
  {
    id: "dados",
    slugs: ["sql", "postgresql", "mysql", "mongodb", "firebase", "supabase"],
  },
  {
    id: "devops",
    slugs: ["devops", "docker", "kubernetes", "aws", "git", "linux"],
  },
  {
    id: "temas",
    slugs: ["ia", "testes", "seguranca", "carreira", "iniciante"],
  },
] as const;

export type TagCategoryId = (typeof TAG_CATEGORIES)[number]["id"] | "outros";

const BY_SLUG = new Map<string, TagCategoryId>(
  TAG_CATEGORIES.flatMap((c) => c.slugs.map((s) => [s, c.id] as const)),
);

export function categoryOf(slug: string): TagCategoryId {
  return BY_SLUG.get(slug) ?? "outros";
}

/** Agrupa na ordem das categorias ("outros" por último), sem grupos vazios. Dentro do grupo, mantém a ordem recebida. */
export function groupTagsByCategory<T extends { slug: string }>(
  tags: readonly T[],
): { id: TagCategoryId; tags: T[] }[] {
  const order: TagCategoryId[] = [...TAG_CATEGORIES.map((c) => c.id), "outros"];
  const groups = new Map<TagCategoryId, T[]>(order.map((id) => [id, []]));
  for (const tag of tags) groups.get(categoryOf(tag.slug))!.push(tag);
  return order
    .filter((id) => groups.get(id)!.length)
    .map((id) => ({ id, tags: groups.get(id)! }));
}
