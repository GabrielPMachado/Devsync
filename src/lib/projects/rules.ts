export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 20_000;
export const TAGS_MIN = 1;
export const TAGS_MAX = 5;
export const COMMENT_MAX = 5_000;

export type ProjectInput = { title: string; description: string; tags: string[]; repoUrl: string; siteUrl: string };

export type ProjectErrors = {
  title?: "length";
  description?: "tooLong";
  tags?: "min" | "max";
  repoUrl?: "https";
  siteUrl?: "https";
};

function isHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Confere o formulário de publicar com os mesmos limites do banco. */
export function validateProject(input: ProjectInput): { ok: true; value: ProjectInput } | { ok: false; errors: ProjectErrors } {
  const value: ProjectInput = {
    title: input.title.trim(),
    description: input.description.trim(),
    tags: [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
    repoUrl: input.repoUrl.trim(),
    siteUrl: input.siteUrl.trim(),
  };
  const errors: ProjectErrors = {};
  if (value.title.length < TITLE_MIN || value.title.length > TITLE_MAX) errors.title = "length";
  if (value.description.length > DESCRIPTION_MAX) errors.description = "tooLong";
  if (value.tags.length < TAGS_MIN) errors.tags = "min";
  else if (value.tags.length > TAGS_MAX) errors.tags = "max";
  if (value.repoUrl && !isHttps(value.repoUrl)) errors.repoUrl = "https";
  if (value.siteUrl && !isHttps(value.siteUrl)) errors.siteUrl = "https";
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}
