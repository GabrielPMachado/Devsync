import type { ReactNode } from "react";
import { ANIMATED_FRAME_ART } from "./avatar-frame-animated";

/**
 * Borda do avatar grande do perfil (nos avatares pequenos do feed não aparece).
 * O avatar de dentro mantém sua própria borda escura, que vira o "respiro" entre foto e moldura.
 * Metade das bordas é liberada por insígnia (FRAMES em profile-style.ts); quem trava é o banco.
 */

type FrameArt = { ring: string; extra?: ReactNode };

const RING = "relative inline-flex shrink-0 rounded-full p-[3px]";

function Brackets() {
  // Os colchetes < > da logo, um de cada lado, um pouco para fora da foto.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute -top-[14%] -left-[14%] size-[128%] overflow-visible">
      <g fill="none" stroke="#22D3EE" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 34L2 50L14 66" />
        <path d="M86 34L98 50L86 66" />
      </g>
    </svg>
  );
}

function Orbit() {
  // Uma órbita inclinada com um "satélite": o primeiro projeto no ar.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute -top-[12%] -left-[12%] size-[124%] overflow-visible">
      <ellipse cx="50" cy="50" rx="52" ry="20" transform="rotate(-28 50 50)" fill="none" stroke="#22D3EE" strokeWidth="1.6" opacity="0.7" />
      <circle cx="93" cy="27" r="5" fill="#22D3EE" stroke="#070B14" strokeWidth="2" />
    </svg>
  );
}

function Nodes() {
  // Trilhas curtas com nós nas diagonais, como uma placa de circuito.
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute -top-[16%] -left-[16%] size-[132%] overflow-visible">
      <g fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <path d="M14 14L4 4H-4" />
        <path d="M86 14L96 4H104" />
        <path d="M14 86L4 96H-4" />
        <path d="M86 86L96 96H104" />
      </g>
      <g fill="#070B14" stroke="#22D3EE" strokeWidth="2">
        <circle cx="-4" cy="4" r="3" />
        <circle cx="104" cy="4" r="3" />
        <circle cx="-4" cy="96" r="3" />
        <circle cx="104" cy="96" r="3" />
      </g>
    </svg>
  );
}

// Sem movimento para quem pede menos animação (motion-reduce).
const PULSE = <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-ping rounded-full ring-2 ring-cyan-300/60 [animation-duration:2.4s] motion-reduce:hidden" />;
const AURORA = (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 -z-10 animate-spin rounded-full bg-[conic-gradient(#2563EB,#22D3EE,#34D399,#8B5CF6,#2563EB)] shadow-[0_0_16px_2px_rgb(34_211_238/0.35)] [animation-duration:7s] motion-reduce:animate-none"
  />
);

export const FRAME_ART: Record<string, FrameArt> = {
  azul: { ring: "bg-blue-500" },
  ciano: { ring: "bg-cyan-400" },
  gradiente: { ring: "bg-brand-gradient" },
  neutra: { ring: "bg-ink-300" },
  neon: { ring: "bg-cyan-300 shadow-[0_0_10px_2px_rgb(34_211_238/0.75),0_0_28px_6px_rgb(37_99_235/0.45)]" },
  colchetes: { ring: "bg-[linear-gradient(135deg,#2563EB,#22D3EE)]", extra: <Brackets /> },
  violeta: { ring: "bg-[#8B5CF6]" },
  esmeralda: { ring: "bg-[#34D399]" },
  crepusculo: { ring: "bg-[linear-gradient(135deg,#F59E0B,#EC4899)]" },
  oceano: { ring: "bg-[linear-gradient(135deg,#2563EB,#14B8A6,#34D399)]" },
  dupla: { ring: "bg-cyan-400 shadow-[0_0_0_2px_#070B14,0_0_0_4px_#2563EB]" },
  orbita: { ring: "bg-[linear-gradient(135deg,#2563EB,#22D3EE)]", extra: <Orbit /> },
  circuito: { ring: "bg-[#0F1B3D] ring-2 ring-cyan-400 ring-inset", extra: <Nodes /> },
  chama: { ring: "bg-[conic-gradient(from_180deg,#EF4444,#F97316,#FBBF24,#F97316,#EF4444)] shadow-[0_0_14px_2px_rgb(249_115_22/0.45)]" },
  pulso: { ring: "bg-cyan-400", extra: PULSE },
  aurora: { ring: "isolate bg-transparent", extra: AURORA },
  prisma: { ring: "bg-[conic-gradient(from_90deg,#2563EB,#22D3EE,#8B5CF6,#EC4899,#2563EB)] shadow-[0_0_14px_1px_rgb(139_92_246/0.4)]" },
  dourada: { ring: "bg-[conic-gradient(from_200deg,#FDE68A,#F59E0B,#B45309,#FBBF24,#FDE68A)] shadow-[0_0_14px_1px_rgb(245_158_11/0.35)]" },
  ...ANIMATED_FRAME_ART,
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
