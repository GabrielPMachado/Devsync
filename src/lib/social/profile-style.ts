/**
 * Catálogo da aparência do perfil. As listas espelham as checagens do banco
 * (supabase/migrations/20261124500000_profile_customization.sql e 20261125300000_profile_catalog_v3.sql): mudou aqui,
 * muda lá também.
 */

import type { BadgeKey } from "./badges";

export const STATUSES = ["open_to_work", "building", "learning", "mentoring", "freelance"] as const;
export type ProfileStatus = (typeof STATUSES)[number];

export const BANNER_PRESETS = [
  "aurora", "circuito", "grade", "ondas", "noite", "hex",
  "terminal", "constelacao", "topografia", "blueprint", "crepusculo", "oceano", "prisma", "nebulosa",
  // Animados, liberados por conquista (BANNER_UNLOCKS).
  "digitando", "chuva_digital", "sonar", "batimento", "cadentes", "aurora_viva", "equalizador",
  "sistema_solar", "fluxo", "particulas", "varredura", "mare", "hiperespaco", "mosaico",
] as const;
export type BannerPreset = (typeof BANNER_PRESETS)[number];

export const ACCENTS = [
  "azul", "ciano", "indigo", "violeta", "turquesa", "verde", "lima", "ambar", "laranja", "vermelho", "rosa", "grafite",
  // Animadas, liberadas por conquista (ACCENT_UNLOCKS).
  "mar", "boreal", "neon", "poente", "plasma", "glacial", "brasa", "floresta", "espectro", "galaxia", "ouro", "retro",
] as const;
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
  // Animadas: esta é a cor parada (quem pede menos movimento vê só ela); o ciclo fica em ACCENT_MOTION.
  mar: "#2563EB",
  boreal: "#22D3EE",
  neon: "#22D3EE",
  poente: "#F59E0B",
  plasma: "#8B5CF6",
  glacial: "#7DD3FC",
  brasa: "#EF4444",
  floresta: "#22C55E",
  espectro: "#2563EB",
  galaxia: "#6366F1",
  ouro: "#F59E0B",
  retro: "#EC4899",
};

/**
 * Cores animadas: as paradas do ciclo (a cor de ACCENT_COLORS é a primeira) e o ritmo.
 * O CSS (src/styles/profile-motion.css) anima --accent entre elas.
 */
export const ACCENT_MOTION: Partial<Record<Accent, { stops: readonly string[]; seconds: number }>> = {
  mar: { stops: ["#2563EB", "#22D3EE"], seconds: 6 },
  boreal: { stops: ["#22D3EE", "#34D399", "#8B5CF6"], seconds: 9 },
  neon: { stops: ["#22D3EE", "#A5F3FC"], seconds: 1.6 },
  poente: { stops: ["#F59E0B", "#F97316", "#EC4899"], seconds: 8 },
  plasma: { stops: ["#8B5CF6", "#EC4899"], seconds: 3 },
  glacial: { stops: ["#7DD3FC", "#E0F2FE", "#22D3EE"], seconds: 7 },
  brasa: { stops: ["#EF4444", "#F97316", "#FBBF24"], seconds: 2.2 },
  floresta: { stops: ["#22C55E", "#14B8A6", "#84CC16"], seconds: 10 },
  espectro: { stops: ["#2563EB", "#22D3EE", "#22C55E", "#F59E0B", "#EC4899", "#8B5CF6"], seconds: 12 },
  galaxia: { stops: ["#6366F1", "#8B5CF6", "#2563EB"], seconds: 11 },
  ouro: { stops: ["#F59E0B", "#FDE68A"], seconds: 4 },
  retro: { stops: ["#EC4899", "#22D3EE"], seconds: 5 },
};

/** Banners liberados por conquista (os outros são livres). Espelha public.banner_required_badge(). */
export const BANNER_UNLOCKS: Readonly<Partial<Record<BannerPreset, BadgeKey>>> = {
  digitando: "first_project",
  chuva_digital: "builder",
  sonar: "investigator",
  batimento: "loved",
  cadentes: "popular",
  aurora_viva: "sage",
  equalizador: "debater",
  sistema_solar: "architect",
  fluxo: "demo_live",
  particulas: "fan",
  varredura: "reviewer",
  mare: "helper",
  hiperespaco: "icon",
  mosaico: "connected",
};

/** Cores liberadas por conquista (as outras são livres). Espelha public.accent_required_badge(). */
export const ACCENT_UNLOCKS: Readonly<Partial<Record<Accent, BadgeKey>>> = {
  mar: "first_follower",
  boreal: "first_accepted",
  neon: "commenter",
  poente: "supporter",
  plasma: "mentor",
  glacial: "well_voted",
  brasa: "star",
  floresta: "builder",
  espectro: "influencer",
  galaxia: "researcher",
  ouro: "reference",
  retro: "founder",
};

export type FrameKey =
  | "azul" | "ciano" | "gradiente" | "neutra" | "violeta" | "esmeralda" | "crepusculo" | "oceano" | "dupla"
  | "orbita" | "colchetes" | "circuito" | "chama" | "pulso" | "neon" | "aurora" | "prisma" | "dourada"
  | "cometa" | "radar" | "respiracao" | "tracejada" | "batida" | "ondas" | "arcos" | "brilho" | "pendulo"
  | "eletrons" | "binario" | "hexagono" | "glitch" | "chama_viva" | "cintilante" | "caleidoscopio" | "satelites" | "lendaria";
export type FrameDef = { key: FrameKey; requiresBadge?: BadgeKey };

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
  // Animadas.
  { key: "cometa", requiresBadge: "first_follower" },
  { key: "radar", requiresBadge: "curious" },
  { key: "respiracao", requiresBadge: "first_answer" },
  { key: "tracejada", requiresBadge: "first_accepted" },
  { key: "batida", requiresBadge: "supporter" },
  { key: "ondas", requiresBadge: "commenter" },
  { key: "arcos", requiresBadge: "investigator" },
  { key: "brilho", requiresBadge: "demo_live" },
  { key: "pendulo", requiresBadge: "connected" },
  { key: "eletrons", requiresBadge: "popular" },
  { key: "binario", requiresBadge: "helper" },
  { key: "hexagono", requiresBadge: "prolific" },
  { key: "glitch", requiresBadge: "reviewer" },
  { key: "chama_viva", requiresBadge: "star" },
  { key: "cintilante", requiresBadge: "well_voted" },
  { key: "caleidoscopio", requiresBadge: "influencer" },
  { key: "satelites", requiresBadge: "tireless" },
  { key: "lendaria", requiresBadge: "legend" },
];

export type AvatarFrame = string;
export const FREE_FRAMES: readonly string[] = FRAMES.filter((f) => !f.requiresBadge).map((f) => f.key);
export const FREE_BANNERS: readonly BannerPreset[] = BANNER_PRESETS.filter((b) => !BANNER_UNLOCKS[b]);
export const FREE_ACCENTS: readonly Accent[] = ACCENTS.filter((a) => !ACCENT_UNLOCKS[a]);

const has = (list: readonly string[]) => (v: string) => list.includes(v);
export const isStatus = has(STATUSES) as (v: string) => v is ProfileStatus;
export const isBannerPreset = has(BANNER_PRESETS) as (v: string) => v is BannerPreset;
export const isAccent = has(ACCENTS) as (v: string) => v is Accent;
export const isFrameKey = has(FRAMES.map((f) => f.key));
