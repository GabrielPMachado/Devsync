/**
 * Regras de exibição dos Estudos (seção 5.4 da spec). Funções puras: a ordem
 * em si vem do banco (answers_ordered); aqui ficam o selo, os avisos e as
 * validações dos formulários, com os mesmos limites das colunas do banco.
 */

export type RankedAnswer = { id: string; score: number; createdAt: string; outdatedFlags: number };

export const OUTDATED_THRESHOLD = 3;
export const RECENT_TOP_MIN_SCORE = 5;
export const OLD_ANSWER_YEARS = 2;
export const TITLE_MIN = 10;
export const TITLE_MAX = 150;
export const BODY_MAX = 30_000;
export const TAGS_MIN = 1;
export const TAGS_MAX = 5;
export const TECH_VERSION_MAX = 40;

const TAG_PATTERN = /^[a-z0-9][a-z0-9+#.-]{0,29}$/;

/**
 * A resposta que ganha o selo "mais votada recentemente": publicada depois da
 * aceita, com pontuação >= 5 e >= o dobro da aceita, sem 3 marcações. Se houver
 * mais de uma, a de maior pontuação (empate: a mais nova). Mesma regra do SQL.
 */
export function pickRecentTop(answers: RankedAnswer[], acceptedId: string | null): string | null {
  const accepted = acceptedId ? answers.find((x) => x.id === acceptedId) : undefined;
  if (!accepted) return null;
  const acceptedAt = Date.parse(accepted.createdAt);
  const best = answers
    .filter(
      (x) =>
        x.id !== accepted.id &&
        Date.parse(x.createdAt) > acceptedAt &&
        x.outdatedFlags < OUTDATED_THRESHOLD &&
        x.score >= RECENT_TOP_MIN_SCORE &&
        x.score >= 2 * accepted.score,
    )
    .sort((p, q) => q.score - p.score || Date.parse(q.createdAt) - Date.parse(p.createdAt))[0];
  return best?.id ?? null;
}

/** "flagged": 3+ marcações (aviso forte). "old": mais de 2 anos (aviso discreto). */
export function answerNotice(answer: { createdAt: string; outdatedFlags: number }, now: Date): "flagged" | "old" | null {
  if (answer.outdatedFlags >= OUTDATED_THRESHOLD) return "flagged";
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() - OLD_ANSWER_YEARS);
  return Date.parse(answer.createdAt) < limit.getTime() ? "old" : null;
}

/** Pontuação mostrada: voto negativo só reduz a ordem, nunca aparece como número negativo. */
export function displayScore(score: number): number {
  return Math.max(score, 0);
}

export function normalizeTagSlugs(raw: string): string[] {
  const slugs = raw
    .split(/[\s,]+/)
    .map((t) => t.trim().toLowerCase().replace(/^#+/, ""))
    .filter((t) => TAG_PATTERN.test(t));
  return [...new Set(slugs)];
}

export type QuestionErrors = {
  title?: "short" | "long";
  body?: "required" | "long";
  tags?: "min" | "max";
};

export function validateQuestion({ title, body, tags }: { title: string; body: string; tags: string[] }): QuestionErrors {
  const errors: QuestionErrors = {};
  const t = title.trim();
  if (t.length < TITLE_MIN) errors.title = "short";
  else if (t.length > TITLE_MAX) errors.title = "long";
  if (!body.trim()) errors.body = "required";
  else if (body.length > BODY_MAX) errors.body = "long";
  if (tags.length < TAGS_MIN) errors.tags = "min";
  else if (tags.length > TAGS_MAX) errors.tags = "max";
  return errors;
}

export type AnswerErrors = { body?: "required" | "long"; techVersion?: "long" };

export function validateAnswer({ body, techVersion }: { body: string; techVersion: string }): AnswerErrors {
  const errors: AnswerErrors = {};
  if (!body.trim()) errors.body = "required";
  else if (body.length > BODY_MAX) errors.body = "long";
  if (techVersion.trim().length > TECH_VERSION_MAX) errors.techVersion = "long";
  return errors;
}
