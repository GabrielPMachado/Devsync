import type { InputHTMLAttributes } from "react";

const BASE = "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-xs transition-colors";

/** Tag só para mostrar (ex.: "react"). */
export function TagChip({ name }: { name: string }) {
  return <span className={`${BASE} border-border-default bg-bg-elevated text-text-secondary`}>{name}</span>;
}

/** Tag que liga e desliga, como as de "Que assuntos você quer acompanhar?". É um checkbox. */
export function TagToggle({ name, ...input }: { name: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "name">) {
  return (
    <label
      className={`${BASE} cursor-pointer border-border-default bg-bg-elevated text-text-secondary has-checked:border-brand-accent has-checked:bg-brand-accent-soft has-checked:text-brand-accent has-focus-visible:outline-2 has-focus-visible:outline-border-focus`}
    >
      <input type="checkbox" className="sr-only" {...input} />
      {name}
    </label>
  );
}
