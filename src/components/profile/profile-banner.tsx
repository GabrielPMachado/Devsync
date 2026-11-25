import { useId, type ReactNode } from "react";

/**
 * Banner do perfil (proporção 3:1). Ordem: imagem enviada > banner pronto > gradiente padrão.
 * Os banners prontos são SVG desenhados aqui, nas cores da marca (fundo escuro, azul e ciano),
 * sem arquivo extra para baixar. Tudo é decorativo (aria-hidden).
 */

const W = 1500;
const H = 500;

type Art = (id: (name: string) => string) => ReactNode;

/** Pontos fixos (sem aleatório, para o servidor e o navegador desenharem igual). */
function seeded(n: number, seed: number): [number, number, number][] {
  let s = seed;
  const next = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => [next() * W, next() * H, next()]);
}

const STARS = seeded(90, 7);

function hexPath(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join("L")}Z`;
}

const HEXES = (() => {
  const r = 46;
  const w = Math.sqrt(3) * r;
  const out: { d: string; glow: number }[] = [];
  for (let row = -1; row < 8; row++) {
    for (let col = -1; col < 22; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0);
      const cy = row * r * 1.5;
      // Mais aceso à direita, sumindo para a esquerda (deixa o nome legível).
      const glow = Math.max(0, Math.min(1, (cx - 500) / 1000));
      out.push({ d: hexPath(cx, cy, r - 3), glow });
    }
  }
  return out;
})();


const FAR_STARS = seeded(140, 23);

// Linhas de código (larguras e cores fixas), alinhadas à direita do banner.
const CODE = seeded(13, 41).map(([, , r], i) => ({
  y: 70 + i * 30,
  indent: [0, 1, 1, 2, 2, 1, 0, 0, 1, 2, 3, 1, 0][i] * 34,
  parts: [60 + r * 90, 40 + ((r * 7) % 1) * 140, 30 + ((r * 13) % 1) * 80],
}));
const CODE_COLORS = ["#22D3EE", "#60A5FA", "#A78BFA", "#94A3B8"];

/** Curvas de nível: anéis irregulares em volta de um "pico". */
function contour(cx: number, cy: number, r: number, k: number) {
  let d = "";
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const rr = r * (1 + 0.13 * Math.sin(a * 3 + k) + 0.07 * Math.sin(a * 5 - k * 2));
    d += `${i ? "L" : "M"}${(cx + rr * Math.cos(a) * 1.6).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

const CONSTELLATION: [number, number][] = [[880, 120], [990, 90], [1090, 150], [1180, 110], [1260, 200], [1150, 260], [1030, 230], [1370, 80]];
const CONSTELLATION_LINES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 2], [3, 7]];

function ridge(base: number, amp: number, seed: number) {
  let d = `M0 ${H}`;
  for (let x = 0; x <= W; x += 50) d += `L${x} ${(base - Math.abs(Math.sin((x + seed) / 190)) * amp - Math.sin((x + seed * 3) / 70) * amp * 0.15).toFixed(1)}`;
  return `${d}L${W} ${H}Z`;
}

export const BANNER_ART: Record<string, Art> = {
  aurora: (id) => (
    <>
      <defs>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="70" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#070B14" />
      <g filter={`url(#${id("blur")})`} opacity="0.85">
        <ellipse cx="380" cy="120" rx="420" ry="140" fill="#2563EB" />
        <ellipse cx="900" cy="300" rx="380" ry="120" fill="#22D3EE" opacity="0.55" />
        <ellipse cx="1300" cy="110" rx="300" ry="130" fill="#7C3AED" opacity="0.6" />
      </g>
    </>
  ),
  circuito: () => {
    const traces = [
      "M0 120H260L320 180H620L660 140H900",
      "M1500 90H1240L1180 150H980L940 110H900",
      "M0 330H180L240 270H520L580 330H760",
      "M1500 380H1300L1240 320H1040L990 370H760",
      "M620 180V260L680 320H760",
      "M980 150V230L920 290H860",
      "M300 500V420L360 360H460",
      "M1180 500V430L1120 380H1040",
    ];
    const nodes = [[900, 140], [900, 110], [760, 330], [760, 370], [760, 320], [860, 290], [460, 360], [1040, 380], [260, 120], [1240, 90]];
    return (
      <>
        <rect width={W} height={H} fill="#0B1120" />
        <g fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinejoin="round" opacity="0.45">
          {traces.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fill="#0B1120" stroke="#22D3EE" strokeWidth="2.5">
          {nodes.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="6" />
          ))}
        </g>
        <rect x="700" y="200" width="240" height="90" rx="10" fill="#0F1B3D" stroke="#2563EB" strokeWidth="2.5" />
      </>
    );
  },
  grade: (id) => {
    const horizon = 210;
    const lines = Array.from({ length: 9 }, (_, i) => horizon + Math.pow(i / 8, 1.8) * (H - horizon));
    const rays = Array.from({ length: 31 }, (_, i) => -2250 + i * 150);
    return (
      <>
        <defs>
          <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070B14" />
            <stop offset="1" stopColor="#0F1B3D" />
          </linearGradient>
          <linearGradient id={id("haze")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id={id("fade")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22D3EE" stopOpacity="0" />
            <stop offset="1" stopColor="#22D3EE" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${id("sky")})`} />
        <rect y={horizon - 70} width={W} height="70" fill={`url(#${id("haze")})`} />
        <line x1="0" x2={W} y1={horizon} y2={horizon} stroke="#22D3EE" strokeWidth="2" opacity="0.7" />
        <g stroke={`url(#${id("fade")})`} strokeWidth="1.5">
          {lines.map((y) => (
            <line key={y} x1="0" x2={W} y1={y} y2={y} />
          ))}
          {rays.map((x) => (
            <line key={x} x1={W / 2} y1={horizon} x2={W / 2 + x * 1.6} y2={H} />
          ))}
        </g>
      </>
    );
  },
  ondas: (id) => {
    const wave = (y: number, amp: number, len: number, shift: number) => {
      let d = `M0 ${y}`;
      for (let x = 0; x <= W; x += 25) d += `L${x} ${(y + Math.sin((x + shift) / len) * amp).toFixed(1)}`;
      return `${d}L${W} ${H}L0 ${H}Z`;
    };
    return (
      <>
        <defs>
          <linearGradient id={id("w")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2563EB" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#070B14" />
        <path d={wave(230, 40, 160, 0)} fill={`url(#${id("w")})`} opacity="0.18" />
        <path d={wave(300, 34, 130, 220)} fill={`url(#${id("w")})`} opacity="0.28" />
        <path d={wave(370, 26, 110, 90)} fill={`url(#${id("w")})`} opacity="0.45" />
        <path d={wave(440, 18, 90, 400)} fill="#0B1120" opacity="0.9" />
      </>
    );
  },
  noite: (id) => (
    <>
      <defs>
        <radialGradient id={id("glow")} cx="0.78" cy="0.25" r="0.6">
          <stop offset="0" stopColor="#1D4ED8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#070B14" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#070B14" />
      <rect width={W} height={H} fill={`url(#${id("glow")})`} />
      <g fill="#E2E8F0">
        {STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(0.6 + r * 1.6).toFixed(2)} opacity={(0.25 + r * 0.7).toFixed(2)} />
        ))}
      </g>
      <mask id={id("moon")}>
        <circle cx="1170" cy="125" r="46" fill="#fff" />
        <circle cx="1192" cy="110" r="42" fill="#000" />
      </mask>
      <circle cx="1170" cy="125" r="46" fill="#CBD5E1" opacity="0.9" mask={`url(#${id("moon")})`} />
    </>
  ),
  hex: (id) => (
    <>
      <defs>
        <linearGradient id={id("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#070B14" />
          <stop offset="1" stopColor="#0F1B3D" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id("bg")})`} />
      <g fill="none" strokeWidth="2">
        {HEXES.map(({ d, glow }) => (
          <path key={d} d={d} stroke={glow > 0.6 ? "#22D3EE" : "#2563EB"} opacity={(0.08 + glow * 0.5).toFixed(2)} />
        ))}
      </g>
    </>
  ),
  terminal: (id) => (
    <>
      <defs>
        <linearGradient id={id("fade")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.25" stopColor="#0A0F1A" stopOpacity="1" />
          <stop offset="0.6" stopColor="#0A0F1A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#0A0F1A" />
      <g transform="translate(720 0)">
        {CODE.map((l, i) => {
          let x = l.indent;
          return (
            <g key={i}>
              <text x="-46" y={l.y + 9} fill="#334155" fontSize="16" fontFamily="monospace" textAnchor="end">
                {i + 1}
              </text>
              {l.parts.map((w, j) => {
                const r = <rect key={j} x={x} y={l.y} width={w} height="12" rx="6" fill={CODE_COLORS[(i + j) % 4]} opacity={j === 0 ? 0.75 : 0.4} />;
                x += w + 14;
                return r;
              })}
            </g>
          );
        })}
        <rect x={CODE[12].indent + 250} y={CODE[12].y - 4} width="12" height="22" fill="#22D3EE" />
      </g>
      <rect width={W} height={H} fill={`url(#${id("fade")})`} />
    </>
  ),
  constelacao: (id) => (
    <>
      <defs>
        <radialGradient id={id("glow")} cx="0.72" cy="0.35" r="0.55">
          <stop offset="0" stopColor="#1E3A8A" stopOpacity="0.6" />
          <stop offset="1" stopColor="#060912" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#060912" />
      <rect width={W} height={H} fill={`url(#${id("glow")})`} />
      <g fill="#CBD5E1">
        {FAR_STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(0.4 + r).toFixed(2)} opacity={(0.15 + r * 0.45).toFixed(2)} />
        ))}
      </g>
      <g stroke="#22D3EE" strokeWidth="1.5" opacity="0.55">
        {CONSTELLATION_LINES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={CONSTELLATION[a][0]} y1={CONSTELLATION[a][1]} x2={CONSTELLATION[b][0]} y2={CONSTELLATION[b][1]} />
        ))}
      </g>
      <g fill="#E0F2FE">
        {CONSTELLATION.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />
        ))}
      </g>
    </>
  ),
  topografia: () => (
    <>
      <rect width={W} height={H} fill="#081018" />
      <g fill="none" stroke="#22D3EE" strokeWidth="1.5">
        {Array.from({ length: 11 }, (_, i) => (
          <path key={i} d={contour(1120, 230, 24 + i * 34, i * 0.5)} opacity={(0.6 - i * 0.045).toFixed(2)} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <path key={`b${i}`} d={contour(330, 420, 30 + i * 36, i * 0.7 + 2)} opacity={(0.25 - i * 0.04).toFixed(2)} />
        ))}
      </g>
    </>
  ),
  blueprint: (id) => (
    <>
      <defs>
        <pattern id={id("minor")} width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M25 0H0V25" fill="none" stroke="#93C5FD" strokeWidth="0.6" opacity="0.18" />
        </pattern>
        <pattern id={id("major")} width="125" height="125" patternUnits="userSpaceOnUse">
          <path d="M125 0H0V125" fill="none" stroke="#BFDBFE" strokeWidth="1" opacity="0.28" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#0B2350" />
      <rect width={W} height={H} fill={`url(#${id("minor")})`} />
      <rect width={W} height={H} fill={`url(#${id("major")})`} />
      <g fill="none" stroke="#E0F2FE" strokeWidth="2" opacity="0.7">
        <circle cx="1130" cy="230" r="110" />
        <circle cx="1130" cy="230" r="60" strokeDasharray="8 8" />
        <rect x="880" y="140" width="170" height="180" />
        <path d="M880 360H1240M880 352V368M1240 352V368" />
        <path d="M1130 100V360M1000 230H1260" strokeDasharray="3 9" opacity="0.6" />
      </g>
      <text x="1060" y="390" fill="#E0F2FE" opacity="0.6" fontSize="18" fontFamily="monospace">
        360 px
      </text>
    </>
  ),
  crepusculo: (id) => (
    <>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140B2A" />
          <stop offset="0.55" stopColor="#7C2D5B" />
          <stop offset="0.85" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id("sky")})`} />
      <circle cx="1080" cy="330" r="90" fill="#FDE68A" opacity="0.85" />
      <path d={ridge(360, 120, 40)} fill="#3B1840" />
      <path d={ridge(420, 80, 300)} fill="#1F0F2E" />
      <path d={ridge(470, 40, 520)} fill="#0D0817" />
    </>
  ),
  oceano: (id) => (
    <>
      <defs>
        <linearGradient id={id("deep")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E7490" />
          <stop offset="1" stopColor="#042F2E" />
        </linearGradient>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${id("deep")})`} />
      <g filter={`url(#${id("blur")})`} fill="#5EEAD4" opacity="0.35">
        <polygon points="900,0 1000,0 760,500 620,500" />
        <polygon points="1160,0 1230,0 1080,500 980,500" />
        <polygon points="1380,0 1440,0 1360,500 1280,500" />
      </g>
      <g fill="none" stroke="#99F6E4" strokeWidth="1.5" opacity="0.25">
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M0 ${60 + i * 26}Q375 ${40 + i * 26} 750 ${60 + i * 26}T1500 ${60 + i * 26}`} />
        ))}
      </g>
    </>
  ),
  prisma: (id) => {
    const rays = ["#2563EB", "#22D3EE", "#34D399", "#FBBF24", "#EC4899", "#8B5CF6"];
    return (
      <>
        <defs>
          <linearGradient id={id("beam")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#E2E8F0" stopOpacity="0" />
            <stop offset="1" stopColor="#E2E8F0" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#070B14" />
        <polygon points="420,300 900,236 900,252" fill={`url(#${id("beam")})`} />
        {rays.map((c, i) => (
          <polygon key={c} points={`960,${236 + i * 3} 1500,${40 + i * 62} 1500,${92 + i * 62}`} fill={c} opacity="0.28" />
        ))}
        <polygon points="930,150 1020,310 840,310" fill="#0F1B3D" stroke="#E2E8F0" strokeWidth="2.5" strokeLinejoin="round" opacity="0.95" />
      </>
    );
  },
  nebulosa: (id) => (
    <>
      <defs>
        <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="60" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#07060F" />
      <g filter={`url(#${id("blur")})`}>
        <ellipse cx="1050" cy="220" rx="330" ry="120" fill="#7C3AED" opacity="0.6" transform="rotate(-12 1050 220)" />
        <ellipse cx="1220" cy="300" rx="220" ry="90" fill="#EC4899" opacity="0.4" />
        <ellipse cx="860" cy="150" rx="200" ry="80" fill="#2563EB" opacity="0.55" />
      </g>
      <g fill="#F1F5F9">
        {FAR_STARS.map(([x, y, r], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(0.3 + r * 0.9).toFixed(2)} opacity={(0.2 + r * 0.5).toFixed(2)} />
        ))}
      </g>
    </>
  ),
};

type Props = { bannerUrl?: string | null; preset?: string | null; className?: string };

export function ProfileBanner({ bannerUrl, preset, className = "" }: Props) {
  const raw = useId();
  // Cantos e borda vêm de quem usa (o perfil usa rounded-2xl com borda; a prévia não).
  const base = `relative overflow-hidden ${className}`;
  if (bannerUrl) {
    return (
      <div aria-hidden="true" data-banner="imagem" className={base}>
        {/* Banner do Storage; <img> simples como o Avatar. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bannerUrl} alt="" className="absolute inset-0 size-full object-cover" />
      </div>
    );
  }
  const art = preset ? BANNER_ART[preset] : undefined;
  if (!art) {
    return <div aria-hidden="true" data-banner="padrao" className={`${base} bg-[linear-gradient(135deg,rgb(37_99_235/0.45),rgb(34_211_238/0.15))]`} />;
  }
  const prefix = `b${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div aria-hidden="true" data-banner={preset} className={`${base} bg-bg-base`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {art((name) => `${prefix}-${name}`)}
      </svg>
    </div>
  );
}
