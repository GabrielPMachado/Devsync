import { ACCENT_COLORS, ACCENT_MOTION, isAccent, type Accent } from "@/lib/social/profile-style";

/**
 * Tom claro de cada cor parada, para texto sobre o fundo escuro (contraste AA).
 * As animadas clareiam a própria cor (color-mix com branco).
 * A cor "cheia" (ACCENT_COLORS) fica para bordas, anéis e ícones.
 */
const ACCENT_TEXT: Partial<Record<Accent, string>> = {
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

export type AccentStyle = { "--accent": string; "--accent-text": string; "--accent-anim"?: string; animation?: string };

/**
 * Variáveis CSS da cor de destaque do perfil (sem escolha = azul). Só o perfil usa.
 * Cor animada: --accent passa a seguir --accent-anim, que a keyframe pm-accent-<cor>
 * (src/styles/profile-motion.css) faz variar. A keyframe só existe para quem não pediu
 * menos movimento; para os outros fica a cor parada. "steps" limita a ~12 trocas por
 * segundo, para não redesenhar a página inteira a cada quadro.
 */
export function accentStyle(accent: string | null | undefined): AccentStyle {
  const key: Accent = accent && isAccent(accent) ? accent : "azul";
  const motion = ACCENT_MOTION[key];
  if (!motion) return { "--accent": ACCENT_COLORS[key], "--accent-text": ACCENT_TEXT[key] ?? ACCENT_COLORS[key] };
  return {
    "--accent-anim": ACCENT_COLORS[key],
    "--accent": "var(--accent-anim)",
    "--accent-text": `color-mix(in srgb, var(--accent-anim) 70%, #fff)`,
    animation: accentAnimation(key),
  };
}

/** A animação de uma cor animada (vazia para as paradas). Serve também para a amostra na tela de editar. */
export function accentAnimation(accent: Accent): string | undefined {
  const motion = ACCENT_MOTION[accent];
  if (!motion) return undefined;
  return `pm-accent-${accent} ${motion.seconds}s steps(${Math.round(motion.seconds * 12)}) infinite alternate`;
}
