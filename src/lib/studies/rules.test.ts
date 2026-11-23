import { describe, expect, it } from "vitest";
import {
  answerNotice,
  displayScore,
  normalizeTagSlugs,
  pickRecentTop,
  validateAnswer,
  validateQuestion,
  type RankedAnswer,
} from "./rules";

const at = (minutesAgo: number) => new Date(Date.UTC(2026, 10, 23, 12, 0) - minutesAgo * 60_000).toISOString();
const a = (id: string, score: number, minutesAgo: number, outdatedFlags = 0): RankedAnswer => ({ id, score, createdAt: at(minutesAgo), outdatedFlags });

describe("pickRecentTop (seção 5.4, regra 1)", () => {
  it("mais nova com pontuação >= 5 e >= 2x a aceita passa à frente", () => {
    expect(pickRecentTop([a("A", 2, 60), a("N", 5, 30)], "A")).toBe("N");
  });
  it("abaixo de 5 não passa", () => {
    expect(pickRecentTop([a("A", 2, 60), a("N", 4, 30)], "A")).toBeNull();
  });
  it("abaixo do dobro não passa", () => {
    expect(pickRecentTop([a("A", 3, 60), a("N", 5, 30)], "A")).toBeNull();
  });
  it("resposta mais antiga que a aceita não passa", () => {
    expect(pickRecentTop([a("O", 10, 90), a("A", 0, 60)], "A")).toBeNull();
  });
  it("só a mais forte passa; empate vai para a mais nova", () => {
    expect(pickRecentTop([a("A", 1, 60), a("N1", 6, 40), a("N2", 8, 30)], "A")).toBe("N2");
    expect(pickRecentTop([a("A", 1, 60), a("N1", 8, 40), a("N2", 8, 30)], "A")).toBe("N2");
  });
  it("resposta com 3 marcações de 'não funciona mais' não passa", () => {
    expect(pickRecentTop([a("A", 1, 60), a("N", 9, 30, 3)], "A")).toBeNull();
  });
  it("sem aceita não há selo", () => {
    expect(pickRecentTop([a("X", 9, 60), a("Y", 1, 30)], null)).toBeNull();
  });
  it("aceita negativa: o dobro conta como zero", () => {
    expect(pickRecentTop([a("A", -2, 60), a("N", 5, 30)], "A")).toBe("N");
  });
});

describe("answerNotice", () => {
  const now = new Date("2026-11-23T12:00:00Z");
  it("sem aviso para resposta recente", () => {
    expect(answerNotice({ createdAt: "2026-01-01T00:00:00Z", outdatedFlags: 2 }, now)).toBeNull();
  });
  it("aviso discreto depois de 2 anos", () => {
    expect(answerNotice({ createdAt: "2024-11-23T11:59:00Z", outdatedFlags: 0 }, now)).toBe("old");
    expect(answerNotice({ createdAt: "2024-11-23T12:01:00Z", outdatedFlags: 0 }, now)).toBeNull();
  });
  it("aviso forte com 3 marcações, mesmo se antiga", () => {
    expect(answerNotice({ createdAt: "2026-11-01T00:00:00Z", outdatedFlags: 3 }, now)).toBe("flagged");
    expect(answerNotice({ createdAt: "2020-01-01T00:00:00Z", outdatedFlags: 4 }, now)).toBe("flagged");
  });
});

describe("displayScore", () => {
  it("nunca mostra número negativo", () => {
    expect(displayScore(-3)).toBe(0);
    expect(displayScore(0)).toBe(0);
    expect(displayScore(7)).toBe(7);
  });
});

describe("normalizeTagSlugs", () => {
  it("separa por vírgula e espaço, minúsculas, sem # e sem repetição", () => {
    expect(normalizeTagSlugs("React, #nextjs  react\nC#  node.js")).toEqual(["react", "nextjs", "c#", "node.js"]);
  });
  it("descarta o que não é slug válido", () => {
    expect(normalizeTagSlugs("ação, -x, ok, " + "a".repeat(31))).toEqual(["ok"]);
  });
});

describe("validateQuestion", () => {
  const ok = { title: "Como invalidar o cache?", body: "Detalhes", tags: ["nextjs"] };
  it("aceita pergunta válida", () => {
    expect(validateQuestion(ok)).toEqual({});
  });
  it("título entre 10 e 150 caracteres", () => {
    expect(validateQuestion({ ...ok, title: "Curto" }).title).toBe("short");
    expect(validateQuestion({ ...ok, title: "x".repeat(151) }).title).toBe("long");
    expect(validateQuestion({ ...ok, title: "   " + "x".repeat(9) + "   " }).title).toBe("short");
  });
  it("corpo obrigatório e até 30000", () => {
    expect(validateQuestion({ ...ok, body: "  " }).body).toBe("required");
    expect(validateQuestion({ ...ok, body: "x".repeat(30001) }).body).toBe("long");
  });
  it("de 1 a 5 tags", () => {
    expect(validateQuestion({ ...ok, tags: [] }).tags).toBe("min");
    expect(validateQuestion({ ...ok, tags: ["a", "b", "c", "d", "e", "f"] }).tags).toBe("max");
  });
});

describe("validateAnswer", () => {
  it("corpo obrigatório e versão até 40", () => {
    expect(validateAnswer({ body: "Use revalidatePath", techVersion: "Next.js 16" })).toEqual({});
    expect(validateAnswer({ body: "", techVersion: "" }).body).toBe("required");
    expect(validateAnswer({ body: "x", techVersion: "x".repeat(41) }).techVersion).toBe("long");
  });
});
