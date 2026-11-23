import { describe, expect, it } from "vitest";
import { normalizeUsername, RESERVED_USERNAMES, validateUsername } from "./username";

describe("normalizeUsername", () => {
  it("tira espaços, o @ da frente e deixa em minúsculas", () => {
    expect(normalizeUsername(" @Gabriel ")).toBe("gabriel");
  });
});

describe("validateUsername", () => {
  it("aceita letras minúsculas, números e _", () => {
    expect(validateUsername("ana_souza2")).toEqual({ ok: true, username: "ana_souza2" });
  });

  it("normaliza antes de validar", () => {
    expect(validateUsername(" @Gabriel ")).toEqual({ ok: true, username: "gabriel" });
  });

  it("recusa menos de 3 caracteres", () => {
    expect(validateUsername("ab")).toEqual({ ok: false, reason: "short" });
  });

  it("recusa mais de 30 caracteres", () => {
    expect(validateUsername("a".repeat(31))).toEqual({ ok: false, reason: "long" });
  });

  it("recusa hífen, ponto e acento", () => {
    for (const u of ["gab-riel", "gab.riel", "joão"]) {
      expect(validateUsername(u)).toEqual({ ok: false, reason: "chars" });
    }
  });

  it("recusa os nomes reservados do banco", () => {
    for (const u of RESERVED_USERNAMES.filter((r) => r.length >= 3)) {
      expect(validateUsername(u)).toEqual({ ok: false, reason: "reserved" });
    }
    expect(RESERVED_USERNAMES).toContain("admin");
    expect(RESERVED_USERNAMES).toHaveLength(14);
  });
});
