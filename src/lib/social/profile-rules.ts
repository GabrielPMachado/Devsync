import { isAccent, isBannerPreset, isFrameKey, isStatus } from "./profile-style";

export const NAME_MAX = 80;
export const BIO_MAX = 500;
export const SITE_MAX = 200;
export const HEADLINE_MAX = 80;
export const LOCATION_MAX = 60;
export const PROFILE_TAGS_MAX = 10;

/** Strings vazias = "nenhum". avatarUrl/bannerUrl: ausente = não mexer, "" = remover. */
export type ProfileInput = {
  displayName: string;
  bio: string;
  headline: string;
  location: string;
  status: string;
  github: string;
  linkedin: string;
  x: string;
  youtube: string;
  site: string;
  bannerPreset: string;
  avatarFrame: string;
  accent: string;
  avatarUrl?: string;
  bannerUrl?: string;
  tags: string[];
};
type Invalid = "invalid";
export type ProfileErrors = {
  displayName?: "length";
  bio?: "tooLong";
  headline?: "tooLong";
  location?: "tooLong";
  status?: Invalid;
  github?: Invalid;
  linkedin?: Invalid;
  x?: Invalid;
  youtube?: Invalid;
  site?: "https";
  bannerPreset?: Invalid;
  avatarFrame?: Invalid;
  accent?: Invalid;
  avatarUrl?: Invalid;
  bannerUrl?: Invalid;
  tags?: "max";
};

/** Tira o @, o domínio colado e a barra final; devolve o usuário se casar com o formato. */
function handle(raw: string, domain: RegExp, format: RegExp): string | null {
  const v = raw
    .replace(/[?#].*$/, "")
    .replace(/^(https?:\/\/)?((www|m|mobile|[a-z]{2})\.)?/i, "")
    .replace(domain, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return format.test(v) ? v : null;
}
/** "@ana", "ana", "github.com/ana" ou "https://github.com/ana/" viram "ana". null se não for um usuário do GitHub. */
export const githubUser = (raw: string): string | null => handle(raw, /^github\.com\//i, /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/);
const linkedinUser = (raw: string) => handle(raw, /^linkedin\.com\/in\//i, /^[A-Za-z0-9_%-]{3,100}$/);
const xUser = (raw: string) => handle(raw, /^(x|twitter)\.com\//i, /^[A-Za-z0-9_]{1,15}$/);
const youtubeHandle = (raw: string) => handle(raw, /^youtube\.com\//i, /^[A-Za-z0-9._-]{3,30}$/);

function isHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Só a URL pública do Storage; o banco confere a pasta do dono. */
const isStorageUrl = (v: string) => /^https?:\/\/[^/?#]+\/storage\/v1\/object\/public\/(avatars|banners)\/[^?#]+(\?v=\d+)?$/.test(v);

/** Confere o formulário de editar perfil com os limites do banco. */
export function validateProfile(input: ProfileInput): { ok: true; value: ProfileInput } | { ok: false; errors: ProfileErrors } {
  const trim = (s: string | undefined) => (s ?? "").trim();
  const value: ProfileInput = {
    displayName: trim(input.displayName),
    bio: trim(input.bio),
    headline: trim(input.headline),
    location: trim(input.location),
    status: trim(input.status),
    github: trim(input.github),
    linkedin: trim(input.linkedin),
    x: trim(input.x),
    youtube: trim(input.youtube),
    site: trim(input.site),
    bannerPreset: trim(input.bannerPreset),
    avatarFrame: trim(input.avatarFrame),
    accent: trim(input.accent),
    avatarUrl: input.avatarUrl === undefined ? undefined : input.avatarUrl.trim(),
    bannerUrl: input.bannerUrl === undefined ? undefined : input.bannerUrl.trim(),
    tags: [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
  };
  const errors: ProfileErrors = {};
  if (!value.displayName || value.displayName.length > NAME_MAX) errors.displayName = "length";
  if (value.bio.length > BIO_MAX) errors.bio = "tooLong";
  if (value.headline.length > HEADLINE_MAX) errors.headline = "tooLong";
  if (value.location.length > LOCATION_MAX) errors.location = "tooLong";
  if (value.status && !isStatus(value.status)) errors.status = "invalid";
  if (value.bannerPreset && !isBannerPreset(value.bannerPreset)) errors.bannerPreset = "invalid";
  // Bordas por conquista entram com as insígnias (o banco confere quem liberou).
  if (value.avatarFrame && !isFrameKey(value.avatarFrame)) errors.avatarFrame = "invalid";
  if (value.accent && !isAccent(value.accent)) errors.accent = "invalid";
  for (const [key, parse] of [
    ["github", githubUser],
    ["linkedin", linkedinUser],
    ["x", xUser],
    ["youtube", youtubeHandle],
  ] as const) {
    if (!value[key]) continue;
    const user = parse(value[key]);
    if (user) value[key] = user;
    else errors[key] = "invalid";
  }
  if (value.site && (value.site.length > SITE_MAX || !isHttps(value.site))) errors.site = "https";
  if (value.avatarUrl && !isStorageUrl(value.avatarUrl)) errors.avatarUrl = "invalid";
  if (value.bannerUrl && !isStorageUrl(value.bannerUrl)) errors.bannerUrl = "invalid";
  if (value.tags.length > PROFILE_TAGS_MAX) errors.tags = "max";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
