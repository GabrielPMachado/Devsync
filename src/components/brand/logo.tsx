import { useId } from "react";

/** Logo da Devsync: colchetes < > no quadrado com gradiente azul→ciano, e "Dev" + "sync". */
export function Logo({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  const gid = useId();
  return (
    <span className="inline-flex items-center gap-2" aria-label="Devsync" role="img">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563EB" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill={`url(#${gid})`} />
        <path d="M13 11l-5 5 5 5M19 11l5 5-5 5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withWordmark ? (
        <span aria-hidden="true" className="font-display font-extrabold tracking-tight text-text-primary" style={{ fontSize: size * 0.68 }}>
          Devsync
        </span>
      ) : null}
    </span>
  );
}
