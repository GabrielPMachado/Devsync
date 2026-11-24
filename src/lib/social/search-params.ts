export type SearchKind = "project" | "question" | "profile";
export type SearchTipo = "tudo" | "projetos" | "perguntas" | "pessoas";
export type SearchQuery = { q: string; tipo: SearchTipo; kinds: SearchKind[] | null; tag: string | null };

const KINDS: Record<Exclude<SearchTipo, "tudo">, SearchKind> = { projetos: "project", perguntas: "question", pessoas: "profile" };
export const Q_MAX = 200;
const TAG = /^[a-z0-9][a-z0-9+#.-]{0,29}$/;

type Raw = string | string[] | undefined;
const first = (v: Raw) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lê ?q=&tipo=&tag= da página /busca. */
export function parseSearch(sp: { q?: Raw; tipo?: Raw; tag?: Raw }): SearchQuery {
  const q = first(sp.q).trim().slice(0, Q_MAX);
  const rawTipo = first(sp.tipo);
  const tipo: SearchTipo = Object.hasOwn(KINDS, rawTipo) ? (rawTipo as SearchTipo) : "tudo";
  const tag = first(sp.tag).trim().toLowerCase();
  return { q, tipo, kinds: tipo === "tudo" ? null : [KINDS[tipo as keyof typeof KINDS]], tag: TAG.test(tag) ? tag : null };
}
