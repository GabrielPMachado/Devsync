/** Regras puras da moderação (sem banco), usadas pelo diálogo de denúncia e pelo /admin. */

export const REPORT_TARGETS = ["project", "question", "answer", "comment", "demo", "profile"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ["spam", "rude", "inappropriate", "malicious", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** O banco aceita até 1000 caracteres no motivo; deixamos folga para o rótulo. */
export const REPORT_DETAILS_MAX = 800;

export function isReportTarget(value: string): value is ReportTarget {
  return (REPORT_TARGETS as readonly string[]).includes(value);
}

export type ReasonResult = { ok: true; reason: string } | { ok: false; error: "reason" | "details" | "tooLong" };

/** Texto gravado em reports.reason: "Rótulo" ou "Rótulo: detalhes". */
export function buildReason(key: string, details: string, label: (key: ReportReason) => string): ReasonResult {
  if (!(REPORT_REASONS as readonly string[]).includes(key)) return { ok: false, error: "reason" };
  const reason = key as ReportReason;
  const text = details.trim();
  if (text.length > REPORT_DETAILS_MAX) return { ok: false, error: "tooLong" };
  if (reason === "other" && !text) return { ok: false, error: "details" };
  return { ok: true, reason: text ? `${label(reason)}: ${text}` : label(reason) };
}

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Mesma normalização do banco (public.normalize_domain): minúsculas, sem www, porta ou caminho. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  let host: string;
  if (/^https?:\/\//.test(raw)) {
    try {
      host = new URL(raw).hostname;
    } catch {
      return null;
    }
  } else {
    host = raw.replace(/[/.]+$/, "");
  }
  host = host.replace(/^www\./, "");
  return DOMAIN.test(host) ? host : null;
}
