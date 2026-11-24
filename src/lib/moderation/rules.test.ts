import { describe, expect, it } from "vitest";
import { buildReason, isReportTarget, normalizeDomain, REPORT_DETAILS_MAX, REPORT_REASONS } from "./rules";

describe("buildReason", () => {
  it("usa o rótulo do motivo quando não há detalhes", () => {
    expect(buildReason("rude", "", (k) => `rótulo ${k}`)).toEqual({ ok: true, reason: "rótulo rude" });
  });

  it("junta rótulo e detalhes", () => {
    expect(buildReason("spam", "  link estranho  ", (k) => k)).toEqual({ ok: true, reason: "spam: link estranho" });
  });

  it("motivo 'outro' exige detalhes", () => {
    expect(buildReason("other", "   ", (k) => k)).toEqual({ ok: false, error: "details" });
  });

  it("recusa motivo desconhecido e detalhes longos demais", () => {
    expect(buildReason("xpto", "", (k) => k)).toEqual({ ok: false, error: "reason" });
    expect(buildReason("spam", "x".repeat(REPORT_DETAILS_MAX + 1), (k) => k)).toEqual({ ok: false, error: "tooLong" });
  });

  it("todos os motivos têm chave estável", () => {
    expect(REPORT_REASONS).toEqual(["spam", "rude", "inappropriate", "malicious", "other"]);
  });
});

describe("isReportTarget", () => {
  it("aceita só os tipos do banco", () => {
    for (const t of ["project", "question", "answer", "comment", "demo", "profile"]) expect(isReportTarget(t)).toBe(true);
    expect(isReportTarget("tag")).toBe(false);
  });
});

describe("normalizeDomain", () => {
  it("normaliza domínio digitado ou URL", () => {
    expect(normalizeDomain("  WWW.Golpe.dev/ ")).toBe("golpe.dev");
    expect(normalizeDomain("https://user@App.Golpe.dev:8443/x?y")).toBe("app.golpe.dev");
  });

  it("recusa o que não é domínio", () => {
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("golpe dev")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
  });
});
