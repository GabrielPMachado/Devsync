import { describe, expect, it } from "vitest";
import ptBR from "../../messages/pt-BR.json";
import { defaultLocale, locales } from "./config";

function leaves(obj: object, path: string[] = []): [string, unknown][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === "object" ? leaves(v, [...path, k]) : [[[...path, k].join("."), v]],
  );
}

describe("i18n", () => {
  it("nasce só em pt-BR", () => {
    expect(locales).toEqual(["pt-BR"]);
    expect(defaultLocale).toBe("pt-BR");
  });

  it("não tem texto vazio em pt-BR.json", () => {
    const entries = leaves(ptBR);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(typeof value, key).toBe("string");
      expect((value as string).trim(), key).not.toBe("");
    }
  });
});
