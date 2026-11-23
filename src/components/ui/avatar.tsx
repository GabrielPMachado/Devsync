const SIZES = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-16 text-xl" } as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

type AvatarProps = { name: string; src?: string | null; size?: keyof typeof SIZES; className?: string };

/** Foto de perfil redonda. Sem foto, mostra as iniciais sobre o gradiente da marca. */
export function Avatar({ name, src, size = "md", className = "" }: AvatarProps) {
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${SIZES[size]} ${className}`;
  if (src) {
    // Fotos vêm do GitHub ou do Storage; <img> simples evita configurar domínios no next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={`${base} object-cover`} referrerPolicy="no-referrer" />;
  }
  return (
    <span className={`${base} bg-brand-gradient font-semibold text-text-on-brand`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
