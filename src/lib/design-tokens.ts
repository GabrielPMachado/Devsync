/**
 * Tokens do Design System da Devsync, copiados do Figma
 * (coleções "Primitivos", "Cor" e "Espaço e raio").
 * `src/styles/tokens.css` precisa refletir estes valores; o teste
 * `design-tokens.test.ts` confere os dois.
 */

export const PRIMITIVES = {
  "ink/950": "#070B14",
  "ink/900": "#0B1120",
  "ink/850": "#111827",
  "ink/800": "#161F33",
  "ink/700": "#1E293B",
  "ink/600": "#334155",
  "ink/500": "#475569",
  "ink/400": "#64748B",
  "ink/300": "#94A3B8",
  "ink/200": "#CBD5E1",
  "ink/100": "#E2E8F0",
  "ink/50": "#F8FAFC",
  white: "#FFFFFF",
  "blue/400": "#60A5FA",
  "blue/500": "#3B82F6",
  "blue/600": "#2563EB",
  "blue/700": "#1D4ED8",
  "blue/950": "#0F1B3D",
  "cyan/300": "#67E8F9",
  "cyan/400": "#22D3EE",
  "cyan/500": "#06B6D4",
  "cyan/950": "#082F3A",
  "green/400": "#4ADE80",
  "green/500": "#22C55E",
  "green/950": "#0A2A17",
  "amber/400": "#FBBF24",
  "amber/500": "#F59E0B",
  "amber/950": "#2E1F05",
  "red/400": "#F87171",
  "red/500": "#EF4444",
  "red/950": "#2F0E0E",
} as const;

export type Primitive = keyof typeof PRIMITIVES;

export const SEMANTIC = {
  "bg/base": "ink/950",
  "bg/surface": "ink/900",
  "bg/elevated": "ink/850",
  "bg/hover": "ink/800",
  "bg/muted": "ink/700",
  "border/default": "ink/700",
  "border/strong": "ink/600",
  "border/focus": "cyan/400",
  "text/primary": "ink/50",
  "text/secondary": "ink/200",
  "text/muted": "ink/300",
  "text/subtle": "ink/400",
  "text/on-brand": "white",
  "text/link": "cyan/400",
  "brand/primary": "blue/600",
  "brand/primary-hover": "blue/500",
  "brand/primary-pressed": "blue/700",
  "brand/accent": "cyan/400",
  "brand/primary-soft": "blue/950",
  "brand/accent-soft": "cyan/950",
  "status/success": "green/500",
  "status/success-text": "green/400",
  "status/success-soft": "green/950",
  "status/warning": "amber/500",
  "status/warning-text": "amber/400",
  "status/warning-soft": "amber/950",
  "status/danger": "red/500",
  "status/danger-text": "red/400",
  "status/danger-soft": "red/950",
  "icon/default": "ink/100",
  "icon/muted": "ink/300",
} as const satisfies Record<string, Primitive>;

export const SPACES = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

export const RADII = { none: 0, sm: 6, md: 8, lg: 12, xl: 16, "2xl": 24, full: 999 } as const;

/** "bg/base" → "bg-base", usado como `--color-bg-base` e classe `bg-bg-base`. */
export function cssColorName(token: string): string {
  return token.replace("/", "-");
}
