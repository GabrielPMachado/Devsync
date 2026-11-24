import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/** Página simples de aviso (erro, manutenção, sem internet, não encontrada). */
export function StatusPage({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <Logo size={40} withWordmark={false} />
      <h1 className="font-display text-2xl font-bold text-text-primary">{title}</h1>
      <p className="text-base leading-relaxed text-text-secondary">{text}</p>
      {children ? <div className="flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </main>
  );
}
