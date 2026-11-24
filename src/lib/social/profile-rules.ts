export const NAME_MAX = 80;
export const BIO_MAX = 500;
export const SITE_MAX = 200;
export const PROFILE_TAGS_MAX = 10;

export type ProfileInput = { displayName: string; bio: string; github: string; site: string; tags: string[] };
export type ProfileErrors = { displayName?: "length"; bio?: "tooLong"; github?: "invalid"; site?: "https"; tags?: "max" };

/** "@ana", "ana", "github.com/ana" ou "https://github.com/ana/" viram "ana". null se não for um usuário do GitHub. */
export function githubUser(raw: string): string | null {
  const v = raw.replace(/^@/, "").replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "").replace(/\/+$/, "");
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(v) ? v : null;
}

function isHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Confere o formulário de editar perfil com os limites do banco. */
export function validateProfile(input: ProfileInput): { ok: true; value: ProfileInput } | { ok: false; errors: ProfileErrors } {
  const value: ProfileInput = {
    displayName: input.displayName.trim(),
    bio: input.bio.trim(),
    github: input.github.trim(),
    site: input.site.trim(),
    tags: [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
  };
  const errors: ProfileErrors = {};
  if (!value.displayName || value.displayName.length > NAME_MAX) errors.displayName = "length";
  if (value.bio.length > BIO_MAX) errors.bio = "tooLong";
  if (value.github) {
    const user = githubUser(value.github);
    if (user) value.github = user;
    else errors.github = "invalid";
  }
  if (value.site && (value.site.length > SITE_MAX || !isHttps(value.site))) errors.site = "https";
  if (value.tags.length > PROFILE_TAGS_MAX) errors.tags = "max";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
