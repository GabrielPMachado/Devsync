/**
 * Insígnias conquistadas e as bordas de avatar que elas liberam.
 * Espelha o banco (supabase/migrations/20261124900000_badges.sql e 20261125300000_profile_catalog_v3.sql): public.badge_keys()
 * e public.frame_required_badge() / banner_required_badge() / accent_required_badge(). O banco é quem garante; aqui é só para a tela.
 * Nomes e "como ganhar" ficam em messages/*.json, no grupo "Badges".
 */

import { ACCENT_UNLOCKS, BANNER_UNLOCKS, FRAMES } from "./profile-style";

export const BADGE_KEYS = [
  "founder",
  "first_project", "builder", "architect", "loved",
  "curious", "investigator", "first_answer", "helper", "first_accepted", "mentor", "sage",
  "commenter", "popular", "influencer",
  "demo_live", "prolific", "star",
  "well_voted", "reference", "researcher", "tireless", "legend", "reviewer",
  "first_follower", "connected", "supporter", "fan", "debater", "icon",
] as const;

/** Insígnias da segunda leva: têm ícone animado. */
export const ANIMATED_BADGES: readonly string[] = [
  "demo_live", "prolific", "star",
  "well_voted", "reference", "researcher", "tireless", "legend", "reviewer",
  "first_follower", "connected", "supporter", "fan", "debater", "icon",
];

/** Grupos para a tela (a ordem de BADGE_KEYS já segue estes grupos). */
export const BADGE_GROUPS: readonly { key: "community" | "projects" | "answers"; badges: readonly BadgeKey[] }[] = [
  { key: "projects", badges: ["first_project", "builder", "architect", "prolific", "demo_live", "loved", "star"] },
  {
    key: "answers",
    badges: ["curious", "investigator", "researcher", "first_answer", "helper", "tireless", "well_voted", "reference", "reviewer", "first_accepted", "mentor", "sage", "legend"],
  },
  { key: "community", badges: ["founder", "first_follower", "popular", "influencer", "icon", "connected", "supporter", "fan", "commenter", "debater"] },
];
export type BadgeKey = (typeof BADGE_KEYS)[number];

export type EarnedBadge = { badge: BadgeKey; awardedAt: string };

/** Quantas insígnias aparecem ao lado do nome. */
export const SHOWN_BADGES_MAX = 3;

/** Bordas liberadas por conquista (vem de FRAMES, em profile-style.ts). As outras são livres para todos. */
export const FRAME_UNLOCKS: Readonly<Record<string, BadgeKey>> = Object.fromEntries(
  FRAMES.filter((f) => f.requiresBadge).map((f) => [f.key, f.requiresBadge as BadgeKey]),
);

export function isBadgeKey(value: string): value is BadgeKey {
  return (BADGE_KEYS as readonly string[]).includes(value);
}

/** Só as conquistadas, sem repetir, até 3, na ordem em que a pessoa marcou. */
export function sanitizeShownBadges(selected: string[], earned: readonly string[]): BadgeKey[] {
  const out: BadgeKey[] = [];
  for (const b of selected) {
    if (out.length >= SHOWN_BADGES_MAX) break;
    if (isBadgeKey(b) && earned.includes(b) && !out.includes(b)) out.push(b);
  }
  return out;
}

/** Insígnia que libera a borda, ou null se a borda é livre. */
export function frameRequiredBadge(frame: string | null | undefined): BadgeKey | null {
  return (frame && FRAME_UNLOCKS[frame]) || null;
}

/** Insígnia que libera o banner pronto, ou null se é livre. */
export function bannerRequiredBadge(banner: string | null | undefined): BadgeKey | null {
  return (banner && (BANNER_UNLOCKS as Record<string, BadgeKey>)[banner]) || null;
}

/** Insígnia que libera a cor de destaque, ou null se é livre. */
export function accentRequiredBadge(accent: string | null | undefined): BadgeKey | null {
  return (accent && (ACCENT_UNLOCKS as Record<string, BadgeKey>)[accent]) || null;
}

export function frameLocked(frame: string | null | undefined, earned: readonly string[]): boolean {
  const needed = frameRequiredBadge(frame);
  return needed !== null && !earned.includes(needed);
}

/** Insígnias do perfil: as exibidas só valem se conquistadas (o banco já garante; aqui só filtra lixo). */
export function toBadges(shown: unknown, earned: unknown): { shownBadges: BadgeKey[]; badges: EarnedBadge[] } {
  const badges = ((Array.isArray(earned) ? earned : []) as { badge: string; awarded_at: string }[])
    .filter((b) => isBadgeKey(b.badge))
    .map((b) => ({ badge: b.badge as BadgeKey, awardedAt: b.awarded_at }));
  const has = new Set(badges.map((b) => b.badge));
  const shownBadges = ((Array.isArray(shown) ? shown : []) as string[]).filter((b): b is BadgeKey => isBadgeKey(b) && has.has(b)).slice(0, 3);
  return { shownBadges, badges };
}
