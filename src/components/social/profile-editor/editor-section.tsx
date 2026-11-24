import type { ReactNode } from "react";

/** Cartão de uma seção do editar perfil, com título e uma linha de ajuda. */
export function EditorSection({ id, title, help, children }: { id: string; title: string; help?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-5 rounded-xl border border-border-default bg-bg-surface p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h2 id={`${id}-titulo`} className="font-display text-lg font-semibold text-text-primary">
          {title}
        </h2>
        {help ? <p className="text-sm text-text-muted">{help}</p> : null}
      </header>
      {children}
    </section>
  );
}
