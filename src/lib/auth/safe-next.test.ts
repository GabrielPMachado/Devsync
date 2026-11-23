import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("aceita caminhos internos com query", () => {
    expect(safeNext("/u/ana?aba=projetos")).toBe("/u/ana?aba=projetos");
  });

  it("volta para / quando não há destino", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("recusa endereços externos e truques", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com", "/%2F%2Fevil.com", " /x"]) {
      expect(safeNext(bad), bad).toBe("/");
    }
  });

  it("usa o fallback pedido", () => {
    expect(safeNext("//x", "/boas-vindas")).toBe("/boas-vindas");
  });
});
