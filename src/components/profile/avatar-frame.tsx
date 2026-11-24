import type { ReactNode } from "react";

/**
 * Borda do avatar grande do perfil (nos avatares pequenos do feed não aparece).
 * O avatar de dentro mantém sua própria borda escura, que vira o "respiro" entre foto e moldura.
 * As bordas neon, colchetes e dourada são liberadas por insígnia; quem trava é o banco.
 */

type FrameArt = { ring: string; extra?: ReactNode };

const RING = "relative inline-flex shrink-0 rounded-full p-[3px]";

function Brackets() {
  // Os colchetes < > da logo, um de cada lado, um pouco para fora da foto.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute -inset-[14%] size-[128%] overflow-visible">
      <g fill="none" stroke="#22D3EE" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 34L2 50L14 66" />
        <path d="M86 34L98 50L86 66" />
      </g>
    </svg>
  );
}

export const FRAME_ART: Record<string, FrameArt> = {
  azul: { ring: "bg-blue-500" },
  ciano: { ring: "bg-cyan-400" },
  gradiente: { ring: "bg-brand-gradient" },
  neutra: { ring: "bg-ink-300" },
  neon: { ring: "bg-cyan-300 shadow-[0_0_10px_2px_rgb(34_211_238/0.75),0_0_28px_6px_rgb(37_99_235/0.45)]" },
  colchetes: { ring: "bg-[linear-gradient(135deg,#2563EB,#22D3EE)]", extra: <Brackets /> },
  dourada: { ring: "bg-[conic-gradient(from_200deg,#FDE68A,#F59E0B,#B45309,#FBBF24,#FDE68A)] shadow-[0_0_14px_1px_rgb(245_158_11/0.35)]" },
};

export function AvatarFrame({ frame, children, className = "" }: { frame?: string | null; children: ReactNode; className?: string }) {
  const art = frame ? FRAME_ART[frame] : undefined;
  if (!art) return <>{children}</>;
  return (
    <span data-frame={frame} className={`${RING} ${art.ring} ${className}`}>
      {children}
      {art.extra}
    </span>
  );
}
