import { describe, expect, it } from "vitest";
import { parseSearch } from "./search-params";

describe("parseSearch", () => {
  it("padrão: tudo, sem tag", () => {
    expect(parseSearch({})).toEqual({ q: "", tipo: "tudo", kinds: null, tag: null });
  });
  it("mapeia o tipo para os kinds da função de busca", () => {
    expect(parseSearch({ q: " kanban ", tipo: "projetos" })).toMatchObject({ q: "kanban", kinds: ["project"] });
    expect(parseSearch({ tipo: "perguntas" }).kinds).toEqual(["question"]);
    expect(parseSearch({ tipo: "pessoas" }).kinds).toEqual(["profile"]);
    expect(parseSearch({ tipo: "xyz" })).toMatchObject({ tipo: "tudo", kinds: null });
  });
  it("corta a busca em 200 e ignora tag inválida", () => {
    expect(parseSearch({ q: "a".repeat(300) }).q).toHaveLength(200);
    expect(parseSearch({ tag: "React" }).tag).toBe("react");
    expect(parseSearch({ tag: "<script>" }).tag).toBeNull();
  });
  it("aceita listas repetidas na URL pegando o primeiro", () => {
    expect(parseSearch({ q: ["a", "b"] }).q).toBe("a");
  });
});
