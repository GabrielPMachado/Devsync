import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * As 18 bordas animadas (todas liberadas por conquista). Cada uma tem um movimento
 * diferente, só com CSS (src/styles/profile-motion.css). Para quem pede menos
 * movimento, a borda aparece parada, inteira.
 *
 * Duas formas de desenhar:
 * - "atrás da foto": o aro fica transparente (isolate) e um span -z-10 do tamanho do aro
 *   faz o movimento; só a faixa de 3px aparece em volta da foto;
 * - "em volta": um SVG maior que o aro, por fora da foto (viewBox 0..100).
 */

type FrameArt = { ring: string; extra?: ReactNode };

const t = (d: number, dl = 0): CSSProperties => ({ "--d": `${d}s`, "--dl": `${dl}s` }) as CSSProperties;

const BEHIND = "pointer-events-none absolute inset-0 -z-10 rounded-full";
const AROUND = "pointer-events-none absolute overflow-visible";
const OPEN = "isolate bg-transparent";

function Around({ inset, children, className = "", style }: { inset: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`${AROUND} ${className}`}
      style={{ top: `-${inset}%`, left: `-${inset}%`, width: `${100 + inset * 2}%`, height: `${100 + inset * 2}%`, ...style }}
    >
      {children}
    </svg>
  );
}

function Sparkle({ x, y, s, dl, color = "#E0F2FE" }: { x: number; y: number; s: number; dl: number; color?: string }) {
  return (
    <path
      d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`}
      fill={color}
      className="pm pm-twinkle pm-fb"
      style={t(2.4, dl)}
    />
  );
}

/** Texto em 0 e 1 girando em volta da foto. Precisa de id próprio para o caminho do texto. */
function Binary() {
  const id = `bin${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Around inset={22} className="pm pm-spin" style={t(30)}>
      <defs>
        <path id={id} d="M50 8A42 42 0 1 1 49.9 8Z" />
      </defs>
      <text fontFamily="monospace" fontSize="6.4" fill="#22D3EE" opacity="0.85" letterSpacing="1.2">
        <textPath href={`#${id}`}>1 0 1 1 0 1 0 0 1 0 1 1 0 1 0 0 1 1 0 1 0 1 1 0 1 0</textPath>
      </text>
    </Around>
  );
}

function Hexagons() {
  const hex = (r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
    }).join(" ");
  return (
    <>
      <Around inset={16} className="pm pm-spin" style={t(14)}>
        <polygon points={hex(47)} fill="none" stroke="#22D3EE" strokeWidth="1.8" strokeLinejoin="round" />
      </Around>
      <Around inset={16} className="pm pm-spin-rev" style={t(20)}>
        <polygon points={hex(47)} fill="none" stroke="#2563EB" strokeWidth="1.4" strokeLinejoin="round" opacity="0.7" />
      </Around>
    </>
  );
}

export const ANIMATED_FRAME_ART: Record<string, FrameArt> = {
  // Um cometa dando a volta por fora, com cauda.
  cometa: {
    ring: "bg-[linear-gradient(135deg,#1E3A8A,#2563EB)]",
    extra: (
      <span aria-hidden="true" className="pm pm-spin pointer-events-none absolute -inset-[6px] rounded-full" style={t(3.2)}>
        <span className="absolute inset-0 rounded-full bg-[conic-gradient(transparent_0_62%,rgb(103_232_249/0.85))] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
        <span className="absolute top-[-1px] left-1/2 size-[7px] -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_8px_3px_rgb(34_211_238/0.8)]" />
      </span>
    ),
  },

  // Feixe de radar varrendo o aro, com marcas fixas por fora.
  radar: {
    ring: OPEN,
    extra: (
      <>
        <span aria-hidden="true" className={`${BEHIND} pm pm-spin bg-[conic-gradient(#0B2A3A_0_70%,#22D3EE_100%)]`} style={t(2.4)} />
        <Around inset={14}>
          <g stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" opacity="0.7">
            <path d="M50 0V5M100 50H95M50 100V95M0 50H5" />
          </g>
        </Around>
      </>
    ),
  },

  // Brilho que respira devagar.
  respiracao: { ring: "pm pm-breathe bg-cyan-400" },

  // Aro tracejado girando por fora.
  tracejada: {
    ring: "bg-[#0F1B3D]",
    extra: (
      <Around inset={12} className="pm pm-spin" style={t(16)}>
        <circle cx="50" cy="50" r="47" fill="none" stroke="#22D3EE" strokeWidth="2.4" strokeDasharray="5 5" strokeLinecap="round" />
      </Around>
    ),
  },

  // Batida de coração (rosa, de quem apoia projetos).
  batida: {
    ring: OPEN,
    extra: <span aria-hidden="true" className={`${BEHIND} pm pm-heartbeat bg-[#FB7185] shadow-[0_0_12px_2px_rgb(251_113_133/0.5)]`} style={t(1.4)} />,
  },

  // Três ondas saindo do aro, uma atrás da outra.
  ondas: {
    ring: "bg-cyan-400",
    extra: (
      <>
        {[0, -1, -2].map((dl) => (
          <span key={dl} aria-hidden="true" className="pm pm-ripple pointer-events-none absolute inset-0 rounded-full border-2 border-cyan-300/70 opacity-0 motion-reduce:hidden" style={t(3, dl)} />
        ))}
      </>
    ),
  },

  // Dois arcos girando em sentidos opostos.
  arcos: {
    ring: "bg-[#0F1B3D]",
    extra: (
      <>
        <Around inset={14} className="pm pm-spin" style={t(2.2)}>
          <circle cx="50" cy="50" r="47" fill="none" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 225" />
        </Around>
        <Around inset={14} className="pm pm-spin-rev" style={t(3.4)}>
          <circle cx="50" cy="50" r="42" fill="none" stroke="#60A5FA" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="45 220" />
        </Around>
      </>
    ),
  },

  // Um reflexo de luz passando pelo aro.
  brilho: {
    ring: OPEN,
    extra: (
      <span
        aria-hidden="true"
        className={`${BEHIND} pm pm-shimmer bg-[linear-gradient(110deg,#2563EB_35%,#E0F2FE_50%,#22D3EE_58%,#2563EB_70%)] bg-[length:260%_100%] bg-[position:30%_0]`}
        style={t(3)}
      />
    ),
  },

  // Uma luz balançando de um lado para o outro, como um pêndulo.
  pendulo: {
    ring: OPEN,
    extra: <span aria-hidden="true" className={`${BEHIND} pm pm-swing bg-[conic-gradient(#0F1B3D_0_38%,#22D3EE_50%,#0F1B3D_62%)]`} style={t(1.8)} />,
  },

  // Dois elétrons em órbitas cruzadas.
  eletrons: {
    ring: "bg-[linear-gradient(135deg,#2563EB,#22D3EE)]",
    extra: (
      <Around inset={18}>
        {[28, -28].map((a, i) => (
          <g key={a} transform={`rotate(${a} 50 50) translate(50 50) scale(1 0.38)`}>
            <circle r="48" fill="none" stroke="#67E8F9" strokeWidth="2" opacity="0.4" />
            <g className="pm pm-spin" style={t(2.6 + i * 0.9, -i)}>
              <circle cx="48" cy="0" r="5" fill="#E0F2FE" />
            </g>
          </g>
        ))}
      </Around>
    ),
  },

  // Zeros e uns rodando em volta.
  binario: { ring: "bg-[#0F1B3D] ring-2 ring-cyan-400/70 ring-inset", extra: <Binary /> },

  // Dois hexágonos girando em sentidos opostos.
  hexagono: { ring: "bg-[linear-gradient(135deg,#2563EB,#22D3EE)]", extra: <Hexagons /> },

  // Falha de sinal: cópias em rosa e ciano tremem de vez em quando.
  glitch: {
    ring: "bg-cyan-400",
    extra: (
      <>
        <span aria-hidden="true" className="pm pm-glitch pointer-events-none absolute inset-0 rounded-full border-[3px] border-[#EC4899] opacity-0 mix-blend-screen motion-reduce:hidden" style={t(3.2)} />
        <span aria-hidden="true" className="pm pm-glitch pointer-events-none absolute inset-0 rounded-full border-[3px] border-[#22D3EE] opacity-0 mix-blend-screen motion-reduce:hidden" style={t(3.2, -0.12)} />
      </>
    ),
  },

  // Fogo tremulando.
  chama_viva: {
    ring: OPEN,
    extra: (
      <>
        <span aria-hidden="true" className={`${BEHIND} pm pm-flicker bg-[conic-gradient(from_180deg,#EF4444,#F97316,#FBBF24,#F97316,#EF4444)] shadow-[0_0_16px_3px_rgb(249_115_22/0.55)]`} style={t(1.6)} />
        <span aria-hidden="true" className="pm pm-flicker pointer-events-none absolute -inset-[3px] -z-20 rounded-full bg-[#F97316]/40 blur-[6px]" style={t(2.3, -0.7)} />
      </>
    ),
  },

  // Brilhinhos piscando em volta de um aro de gelo.
  cintilante: {
    ring: "bg-[linear-gradient(135deg,#7DD3FC,#E0F2FE,#22D3EE)]",
    extra: (
      <Around inset={22}>
        <Sparkle x={86} y={14} s={7} dl={0} />
        <Sparkle x={12} y={30} s={5} dl={-0.8} />
        <Sparkle x={90} y={78} s={5} dl={-1.5} />
        <Sparkle x={24} y={90} s={6} dl={-2} />
      </Around>
    ),
  },

  // Cores mudando sem parar.
  caleidoscopio: {
    ring: OPEN,
    extra: <span aria-hidden="true" className={`${BEHIND} pm pm-hue bg-[conic-gradient(#2563EB,#22D3EE,#34D399,#FBBF24,#EC4899,#8B5CF6,#2563EB)]`} style={t(5)} />,
  },

  // Três satélites em órbitas de tamanhos e velocidades diferentes.
  satelites: {
    ring: "bg-[linear-gradient(135deg,#1E3A8A,#22D3EE)]",
    extra: (
      <>
        {[
          { inset: 5, d: 4, color: "bg-cyan-300" },
          { inset: 10, d: 7, color: "bg-blue-400" },
          { inset: 15, d: 11, color: "bg-[#A78BFA]" },
        ].map((o, i) => (
          <span
            key={o.inset}
            aria-hidden="true"
            className="pm pm-spin pointer-events-none absolute rounded-full border border-white/10"
            style={{ ...t(o.d, -i * 2), inset: `-${o.inset}px` }}
          >
            <span className={`absolute top-[-3px] left-1/2 size-[6px] -translate-x-1/2 rounded-full ${o.color}`} />
          </span>
        ))}
      </>
    ),
  },

  // A lendária: ouro e ciano girando, brilho respirando e faíscas.
  lendaria: {
    ring: `${OPEN} pm pm-breathe`,
    extra: (
      <>
        <span aria-hidden="true" className={`${BEHIND} pm pm-spin bg-[conic-gradient(#FDE68A,#F59E0B,#22D3EE,#2563EB,#F59E0B,#FDE68A)]`} style={t(4)} />
        <Around inset={22}>
          <Sparkle x={84} y={12} s={7} dl={0} color="#FDE68A" />
          <Sparkle x={14} y={84} s={6} dl={-1.2} color="#67E8F9" />
          <Sparkle x={8} y={22} s={4} dl={-0.6} color="#FDE68A" />
        </Around>
      </>
    ),
  },
};
