import { ACCENT_COLORS, isAccent, type Accent } from "@/lib/social/profile-style";

/**
 * Tom claro de cada cor, para texto sobre o fundo escuro (contraste AA).
 * A cor "cheia" (ACCENT_COLORS) fica para bordas, anéis e ícones.
 */
const ACCENT_TEXT: Record<Accent, string> = {
  azul: "#60A5FA",
  ciano: "#22D3EE",
  violeta: "#A78BFA",
  verde: "#4ADE80",
  ambar: "#FBBF24",
  rosa: "#F472B6",
  indigo: "#A5B4FC",
  turquesa: "#2DD4BF",
  lima: "#A3E635",
  laranja: "#FB923C",
  vermelho: "#F87171",
  grafite: "#CBD5E1",
};

export type AccentStyle = { "--accent": string; "--accent-text": string };

/** Variáveis CSS da cor de destaque do perfil (sem escolha = azul). Só o perfil usa. */
export function accentStyle(accent: string | null | undefined): AccentStyle {
  const key: Accent = accent && isAccent(accent) ? accent : "azul";
  return { "--accent": ACCENT_COLORS[key], "--accent-text": ACCENT_TEXT[key] };
}
