import type { CSSProperties, ReactNode } from "react";

/**
 * Os 14 banners animados (liberados por conquista). Mesma tela 1500x500 dos outros
 * e a mesma regra: o lado esquerdo fica calmo para o nome continuar legível.
 *
 * Cada um tem um movimento próprio, feito só com CSS (src/styles/profile-motion.css):
 * classe "pm pm-<efeito>" e o ritmo em --d (duração) e --dl (atraso, negativo para já
 * começar no meio). Quem pede menos movimento vê o desenho parado, completo.
 */

const W = 1500;
const H = 500;

type Art = (id: (name: string) => string) => ReactNode;

/** Ritmo de um elemento animado: duração e atraso em segundos. */
const t = (d: number, dl = 0): CSSProperties => ({ "--d": `${d}s`, "--dl": `${dl}s` }) as CSSProperties;

/** Números fixos (sem aleatório, para o servidor e o navegador desenharem igual). */
function seeded(n: number, seed: number): number[][] {
  let s = seed;
  const next = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => [next(), next(), next(), next()]);
}

const BG = "#070B14";

// Dados de cada desenho, calculados uma vez.
const RAIN = seeded(22, 11).map(([a, b, c], i) => ({ x: 760 + i * 33, len: 4 + Math.floor(a * 6), d: 3 + b * 4, dl: -c * 6 }));
const BLIPS = [[1260, 150], [1040, 330], [1330, 300]];
const SKY = seeded(110, 5);
const METEORS = [[1250, 80, 0], [1100, 40, -2.2], [1420, 150, -4.1], [960, 60, -5.6]];
const EQ = seeded(26, 3).map(([a, b], i) => ({ x: 780 + i * 27, h: 120 + a * 230, d: 0.6 + b * 0.9 }));
const PACKETS = [
  "M0 140H300L360 200H700L740 160H1500",
  "M0 360H220L280 300H620L680 360H1500",
  "M760 0V120L820 180V500",
  "M1120 0V90L1060 150V300L1120 360V500",
  "M600 500V420L660 360H900L960 300H1500",
];
const DOTS = seeded(55, 17).map(([a, b, c, e]) => ({ x: 650 + a * 850, y: 260 + b * 260, r: 2 + c * 3.5, d: 5 + e * 6, dl: -a * 10 }));
const WARP = seeded(48, 29).map(([a, b, c]) => ({ angle: a * 360, start: 20 + b * 60, d: 1.2 + c * 1.6, dl: -c * 3 - a }));
const TILES = (() => {
  const out: { x: number; y: number; on: number; d: number; dl: number }[] = [];
  const rnd = seeded(14 * 9, 37);
  let k = 0;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 14; col++) {
      const [a, b, c] = rnd[k++];
      out.push({ x: 820 + col * 48, y: 30 + row * 50, on: a, d: 2 + b * 3, dl: -c * 5 });
    }
  }
  return out;
})();

/** Onda com período de 300 (mover 300 para a esquerda volta ao mesmo desenho). */
function wavePath(y: number, amp: number) {
  let d = `M0 ${H}L0 ${y}`;
  for (let x = 0; x <= W + 300; x += 25) d += `L${x} ${(y + Math.sin((x / 300) * Math.PI * 2) * amp).toFixed(1)}`;
  return `${d}L${W + 300} ${H}Z`;
}

const ECG = (() => {
  let d = "M0 300";
  for (let x = 0; x < W; x += 300) {
    d += `H${x + 140}L${x + 160} 270L${x + 175} 300L${x + 185} 300L${x + 200} 160L${x + 215} 380L${x + 230} 300L${x + 250} 285L${x + 265} 300`;
  }
  return `${d}H${W}`;
})();

export const ANIMATED_BANNER_ART: Record<string, Art> = {
  // Linhas de código aparecendo uma a uma, cursor piscando.
  digitando: () => {
    const lines = [[0, 220], [1, 300], [1, 180], [2, 260], [2, 140], [1, 200], [0, 90], [0, 240], [1, 170]];
    return (
      <>
        <rect width={W} height={H} fill="#0A0F1A" />
        <g transform="translate(760 70)">
          {lines.map(([indent, w], i) => (
            <rect key={i} x={indent * 36} y={i * 40} width={w} height="14" rx="7" fill={["#22D3EE", "#60A5FA", "#A78BFA", "#94A3B8"][i % 4]} opacity={0.6}
              className="pm pm-type pm-fb-l" style={t(9, i * 0.8)} />
          ))}
          <rect x="250" y={8 * 40 - 4} width="12" height="22" fill="#22D3EE" className="pm pm-blink" style={t(1)} />
        </g>
      </>
    );
  },

  // Colunas de "caracteres" caindo.
  chuva_digital: (id) => (
    <>
      <defs>
        <linearGradient id={id("fade")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.4" stopColor={BG} stopOpacity="1" />
          <stop offset="0.6" stopColor={BG} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={BG} />
      {RAIN.map((c, i) => (
        <g key={i} className="pm pm-fall" style={t(c.d, c.dl)}>
          {Array.from({ length: c.len }, (_, j) => (
            <rect key={j} x={c.x} y={j * 26} width="12" height="16" rx="2" fill={j === c.len - 1 ? "#E0F2FE" : "#22D3EE"} opacity={((j + 1) / c.len) * 0.8} />
          ))}
        </g>
      ))}
      <rect width={W} height={H} fill={`url(#${id("fade")})`} />
    </>
  ),

  // Anéis de sonar com feixe girando e pontos acendendo.
  sonar: (id) => (
    <>
      <defs>
        <linearGradient id={id("beam")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22D3EE" stopOpacity="0" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#06101A" />
      <g fill="none" stroke="#22D3EE" opacity="0.3">
        {[60, 120, 180, 240].map((r) => <circle key={r} cx="1150" cy="250" r={r} />)}
        <path d="M890 250H1410M1150 0V500" strokeDasharray="4 8" />
      </g>
      <g className="pm pm-spin" style={{ ...t(5), transformOrigin: "1150px 250px" }}>
        <path d="M1150 250L1390 250A240 240 0 0 0 1320 80Z" fill={`url(#${id("beam")})`} />
      </g>
      {BLIPS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="6" fill="#67E8F9" className="pm pm-ping pm-fb" style={t(5, -i * 1.6)} />
      ))}
    </>
  ),

  // Linha de batimento com um pulso de luz correndo.
  batimento: () => (
    <>
      <rect width={W} height={H} fill="#0B0A14" />
      <path d={ECG} fill="none" stroke="#FB7185" strokeWidth="2" opacity="0.2" />
      <path d={ECG} pathLength={1} fill="none" stroke="#FB7185" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="0.12 0.88" className="pm pm-dash" style={t(3.2)} />
    </>
  ),

  // Céu estrelado com estrelas cadentes.
  cadentes: (id) => (
    <>
      <defs>
        <linearGradient id={id("tail")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E0F2FE" />
          <stop offset="1" stopColor="#E0F2FE" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#050814" />
      <g fill="#CBD5E1">
        {SKY.map(([x, y, r], i) => <circle key={i} cx={(x * W).toFixed(1)} cy={(y * H).toFixed(1)} r={(0.6 + r * 1.2).toFixed(2)} opacity={(0.3 + r * 0.6).toFixed(2)} />)}
      </g>
      {METEORS.map(([x, y, dl], i) => (
        <g key={i} className="pm pm-shoot" style={t(4.5, dl * 0.6)}>
          <line x1={x} y1={y} x2={x + 200} y2={y - 100} stroke={`url(#${id("tail")})`} strokeWidth="3" strokeLinecap="round" />
          <circle cx={x} cy={y} r="3" fill="#F8FAFC" />
        </g>
      ))}
    </>
  ),

  // Manchas de aurora indo e voltando (gradientes, sem desfoque pesado).
  aurora_viva: (id) => (
    <>
      <defs>
        {[["a", "#2563EB"], ["b", "#22D3EE"], ["c", "#34D399"], ["d", "#8B5CF6"]].map(([k, c]) => (
          <radialGradient key={k} id={id(k)}>
            <stop offset="0" stopColor={c} stopOpacity="0.7" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <rect width={W} height={H} fill={BG} />
      <ellipse cx="500" cy="140" rx="520" ry="170" fill={`url(#${id("a")})`} className="pm pm-drift" style={t(9)} />
      <ellipse cx="950" cy="320" rx="460" ry="150" fill={`url(#${id("b")})`} className="pm pm-drift" style={t(11, -4)} />
      <ellipse cx="1250" cy="160" rx="380" ry="150" fill={`url(#${id("c")})`} className="pm pm-drift" style={t(13, -7)} />
      <ellipse cx="1350" cy="380" rx="340" ry="120" fill={`url(#${id("d")})`} className="pm pm-drift" style={t(10, -2)} />
    </>
  ),

  // Barras de equalizador subindo e descendo.
  equalizador: (id) => (
    <>
      <defs>
        <linearGradient id={id("bar")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={BG} />
      <line x1="760" x2={W} y1="430" y2="430" stroke="#1E293B" strokeWidth="2" />
      {EQ.map((b, i) => (
        <rect key={i} x={b.x} y={430 - b.h} width="16" height={b.h} rx="4" fill={`url(#${id("bar")})`} opacity="0.85"
          className="pm pm-eq pm-fb-b" style={t(b.d, -i * 0.13)} />
      ))}
    </>
  ),

  // Planetas em órbita em volta de um sol.
  sistema_solar: (id) => {
    const sun = "1150px 250px";
    const planets = [
      { r: 90, size: 9, color: "#60A5FA", d: 6 },
      { r: 150, size: 13, color: "#22D3EE", d: 11 },
      { r: 215, size: 10, color: "#A78BFA", d: 17 },
      { r: 280, size: 7, color: "#94A3B8", d: 26 },
    ];
    return (
      <>
        <defs>
          <radialGradient id={id("sun")}>
            <stop offset="0" stopColor="#FDE68A" />
            <stop offset="0.5" stopColor="#F59E0B" stopOpacity="0.6" />
            <stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="#060912" />
        <g fill="none" stroke="#334155" strokeWidth="1.2">
          {planets.map((p) => <circle key={p.r} cx="1150" cy="250" r={p.r} />)}
        </g>
        <circle cx="1150" cy="250" r="60" fill={`url(#${id("sun")})`} />
        {planets.map((p, i) => (
          <g key={p.r} className="pm pm-spin" style={{ ...t(p.d, -i * 3), transformOrigin: sun }}>
            <circle cx={1150 + p.r} cy="250" r={p.size} fill={p.color} />
          </g>
        ))}
      </>
    );
  },

  // Trilhas de circuito com pacotes de dados correndo.
  fluxo: () => (
    <>
      <rect width={W} height={H} fill="#0B1120" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {PACKETS.map((d) => <path key={d} d={d} stroke="#1E3A8A" strokeWidth="2" />)}
        {PACKETS.map((d, i) => (
          <path key={`p${d}`} d={d} pathLength={1} stroke="#22D3EE" strokeWidth="3.5" strokeDasharray="0.02 0.08"
            className="pm pm-dash" style={t(6 + i, -i)} />
        ))}
      </g>
    </>
  ),

  // Partículas subindo e sumindo.
  particulas: (id) => (
    <>
      <defs>
        <radialGradient id={id("glow")} cx="0.75" cy="1" r="0.8">
          <stop offset="0" stopColor="#1D4ED8" stopOpacity="0.5" />
          <stop offset="1" stopColor={BG} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={BG} />
      <rect width={W} height={H} fill={`url(#${id("glow")})`} />
      {DOTS.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={p.r.toFixed(1)} fill={i % 3 ? "#22D3EE" : "#93C5FD"} opacity="0.7"
          className="pm pm-rise" style={t(p.d, p.dl)} />
      ))}
    </>
  ),

  // Grade com uma linha de leitura descendo.
  varredura: (id) => (
    <>
      <defs>
        <pattern id={id("grid")} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#22D3EE" strokeWidth="0.8" opacity="0.28" />
        </pattern>
        <linearGradient id={id("trail")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22D3EE" stopOpacity="0" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={id("fade")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.3" stopColor="#081018" stopOpacity="1" />
          <stop offset="0.55" stopColor="#081018" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#081018" />
      <rect width={W} height={H} fill={`url(#${id("grid")})`} />
      <g className="pm pm-scan" style={t(4.5)}>
        <rect y="0" width={W} height="100" fill={`url(#${id("trail")})`} />
        <line x1="0" x2={W} y1="100" y2="100" stroke="#67E8F9" strokeWidth="2.5" />
      </g>
      <rect width={W} height={H} fill={`url(#${id("fade")})`} />
    </>
  ),

  // Camadas de ondas andando em velocidades diferentes.
  mare: (id) => (
    <>
      <defs>
        <linearGradient id={id("sea")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#06101A" />
          <stop offset="1" stopColor="#0C4A6E" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id("sea")})`} />
      <path d={wavePath(250, 22)} fill="#2563EB" opacity="0.2" className="pm pm-wave" style={t(14)} />
      <path d={wavePath(310, 18)} fill="#22D3EE" opacity="0.25" className="pm pm-wave" style={t(9, -3)} />
      <path d={wavePath(380, 14)} fill="#14B8A6" opacity="0.35" className="pm pm-wave" style={t(6, -1)} />
      <path d={wavePath(445, 10)} fill="#06101A" opacity="0.85" className="pm pm-wave" style={t(4)} />
    </>
  ),

  // Riscos de luz saindo do centro, como entrar no hiperespaço.
  hiperespaco: (id) => (
    <>
      <defs>
        <radialGradient id={id("core")}>
          <stop offset="0" stopColor="#1D4ED8" stopOpacity="0.6" />
          <stop offset="1" stopColor="#030510" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#030510" />
      <circle cx="1080" cy="250" r="260" fill={`url(#${id("core")})`} />
      {WARP.map((s, i) => (
        <g key={i} transform={`rotate(${s.angle.toFixed(1)} 1080 250)`}>
          <line x1={1080 + s.start} y1="250" x2={1080 + s.start + 70} y2="250" stroke={i % 4 ? "#E0F2FE" : "#67E8F9"} strokeOpacity="0.85" strokeWidth="2.2" strokeLinecap="round"
            className="pm pm-warp pm-fb-l" style={t(s.d, s.dl)} />
        </g>
      ))}
    </>
  ),

  // Mosaico de quadrados acendendo e apagando.
  mosaico: () => (
    <>
      <rect width={W} height={H} fill="#0A0F1A" />
      {TILES.map((q, i) => {
        // Mais aceso à direita, para o nome à esquerda seguir legível.
        const fade = Math.min(1, (q.x - 800) / 500);
        return (
          <rect key={i} x={q.x} y={q.y} width="40" height="40" rx="6" fill={q.on > 0.7 ? "#22D3EE" : q.on > 0.35 ? "#2563EB" : "#1E293B"}
            opacity={(0.25 + fade * 0.6).toFixed(2)} className={q.on > 0.35 ? "pm pm-glint" : undefined} style={q.on > 0.35 ? t(q.d, q.dl) : undefined} />
        );
      })}
    </>
  ),
};
