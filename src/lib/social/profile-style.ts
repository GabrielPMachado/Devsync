/**
 * Catálogo da aparência do perfil. As listas espelham as checagens do banco
 * (supabase/migrations/20261124500000_profile_customization.sql): mudou aqui,
 * muda lá também.
 */

export const STATUSES = ["open_to_work", "building", "learning", "mentoring", "freelance"] as const;
export type ProfileStatus = (typeof STATUSES)[number];

export const BANNER_PRESETS = ["aurora", "circuito", "grade", "ondas", "noite", "hex"] as const;
export type BannerPreset = (typeof BANNER_PRESETS)[number];

export const ACCENTS = ["azul", "ciano", "violeta", "verde", "ambar", "rosa"] as const;
export type Accent = (typeof ACCENTS)[number];

/** Cor de destaque do perfil (sem escolha = azul). */
export const ACCENT_COLORS: Record<Accent, string> = {
  azul: "#2563EB",
  ciano: "#22D3EE",
  violeta: "#8B5CF6",
  verde: "#22C55E",
  ambar: "#F59E0B",
  rosa: "#EC4899",
};

/** Insígnias que liberam bordas (o catálogo completo de insígnias vive em badges.ts). */
export type FrameBadge = "mentor" | "builder" | "founder";
export type FrameDef = { key: string; requiresBadge?: FrameBadge };

export const FRAMES: readonly FrameDef[] = [
  { key: "azul" },
  { key: "ciano" },
  { key: "gradiente" },
  { key: "neutra" },
  { key: "neon", requiresBadge: "mentor" },
  { key: "colchetes", requiresBadge: "builder" },
  { key: "dourada", requiresBadge: "founder" },
];
export type AvatarFrame = string;
export const FREE_FRAMES = FRAMES.filter((f) => !f.requiresBadge).map((f) => f.key);

const has = (list: readonly string[]) => (v: string) => list.includes(v);
export const isStatus = has(STATUSES) as (v: string) => v is ProfileStatus;
export const isBannerPreset = has(BANNER_PRESETS) as (v: string) => v is BannerPreset;
export const isAccent = has(ACCENTS) as (v: string) => v is Accent;
export const isFrameKey = has(FRAMES.map((f) => f.key));
