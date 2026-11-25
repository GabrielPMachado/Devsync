/**
 * Catálogo da aparência do perfil. As listas espelham as checagens do banco
 * (supabase/migrations/20261124500000_profile_customization.sql e 20261125150000_profile_catalog_v2.sql): mudou aqui,
 * muda lá também.
 */

export const STATUSES = ["open_to_work", "building", "learning", "mentoring", "freelance"] as const;
export type ProfileStatus = (typeof STATUSES)[number];

export const BANNER_PRESETS = [
  "aurora", "circuito", "grade", "ondas", "noite", "hex",
  "terminal", "constelacao", "topografia", "blueprint", "crepusculo", "oceano", "prisma", "nebulosa",
] as const;
export type BannerPreset = (typeof BANNER_PRESETS)[number];

export const ACCENTS = ["azul", "ciano", "indigo", "violeta", "turquesa", "verde", "lima", "ambar", "laranja", "vermelho", "rosa", "grafite"] as const;
export type Accent = (typeof ACCENTS)[number];

/** Cor de destaque do perfil (sem escolha = azul). */
export const ACCENT_COLORS: Record<Accent, string> = {
  azul: "#2563EB",
  ciano: "#22D3EE",
  violeta: "#8B5CF6",
  verde: "#22C55E",
  ambar: "#F59E0B",
  rosa: "#EC4899",
  indigo: "#6366F1",
  turquesa: "#14B8A6",
  lima: "#84CC16",
  laranja: "#F97316",
  vermelho: "#EF4444",
  grafite: "#94A3B8",
};

/** Insígnias que liberam bordas (o catálogo completo de insígnias vive em badges.ts). */
export type FrameBadge = "mentor" | "builder" | "founder" | "first_project" | "architect" | "loved" | "helper" | "sage" | "influencer";
export type FrameKey =
  | "azul" | "ciano" | "gradiente" | "neutra" | "violeta" | "esmeralda" | "crepusculo" | "oceano" | "dupla"
  | "orbita" | "colchetes" | "circuito" | "chama" | "pulso" | "neon" | "aurora" | "prisma" | "dourada";
export type FrameDef = { key: FrameKey; requiresBadge?: FrameBadge };

/** Livres primeiro; as por conquista na ordem em que costumam ser liberadas. */
export const FRAMES: readonly FrameDef[] = [
  { key: "azul" },
  { key: "ciano" },
  { key: "gradiente" },
  { key: "neutra" },
  { key: "violeta" },
  { key: "esmeralda" },
  { key: "crepusculo" },
  { key: "oceano" },
  { key: "dupla" },
  { key: "orbita", requiresBadge: "first_project" },
  { key: "colchetes", requiresBadge: "builder" },
  { key: "circuito", requiresBadge: "architect" },
  { key: "chama", requiresBadge: "loved" },
  { key: "pulso", requiresBadge: "helper" },
  { key: "neon", requiresBadge: "mentor" },
  { key: "aurora", requiresBadge: "sage" },
  { key: "prisma", requiresBadge: "influencer" },
  { key: "dourada", requiresBadge: "founder" },
];
export type AvatarFrame = string;
export const FREE_FRAMES: readonly string[] = FRAMES.filter((f) => !f.requiresBadge).map((f) => f.key);

const has = (list: readonly string[]) => (v: string) => list.includes(v);
export const isStatus = has(STATUSES) as (v: string) => v is ProfileStatus;
export const isBannerPreset = has(BANNER_PRESETS) as (v: string) => v is BannerPreset;
export const isAccent = has(ACCENTS) as (v: string) => v is Accent;
export const isFrameKey = has(FRAMES.map((f) => f.key));
