import type { BannerPreset } from "@/lib/social/profile-style";

/**
 * Visual simples dos banners prontos e das bordas para a prévia e os seletores.
 * O desenho final fica nos componentes da página do perfil (src/components/profile/);
 * quando eles existirem, a prévia passa a usá-los.
 */
export const BANNER_BACKGROUNDS: Record<BannerPreset | "padrao", string> = {
  padrao: "linear-gradient(135deg, rgb(37 99 235 / 0.45), rgb(34 211 238 / 0.15))",
  aurora: "radial-gradient(120% 140% at 10% 0%, #22D3EE66, transparent 55%), radial-gradient(120% 140% at 90% 100%, #8B5CF666, transparent 55%), #0B1120",
  circuito: "repeating-linear-gradient(90deg, #22D3EE22 0 2px, transparent 2px 28px), repeating-linear-gradient(0deg, #2563EB22 0 2px, transparent 2px 28px), #0B1120",
  grade: "linear-gradient(#1E293B 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, #1E293B 1px, transparent 1px) 0 0 / 22px 22px, #070B14",
  ondas: "repeating-radial-gradient(circle at 0% 100%, #2563EB33 0 10px, transparent 10px 22px), #0B1120",
  noite: "linear-gradient(180deg, #070B14, #111827 60%, #1E3A8A)",
  hex: "conic-gradient(from 30deg at 50% 50%, #2563EB33, #22D3EE33, #2563EB33), #0B1120",
};

export const FRAME_RINGS: Record<string, string> = {
  azul: "ring-4 ring-[#2563EB]",
  ciano: "ring-4 ring-[#22D3EE]",
  gradiente: "ring-4 ring-[#22D3EE] shadow-[0_0_0_6px_#2563EB]",
  neutra: "ring-4 ring-[#CBD5E1]",
  neon: "ring-4 ring-[#22D3EE] shadow-[0_0_18px_4px_#22D3EE]",
  colchetes: "ring-4 ring-[#2563EB] outline-2 outline-dashed outline-offset-4 outline-[#22D3EE]",
  dourada: "ring-4 ring-[#F59E0B] shadow-[0_0_12px_2px_#F59E0B66]",
};
