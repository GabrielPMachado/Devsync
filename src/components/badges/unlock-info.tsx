import { Lock, LockOpen } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  /** Arte à esquerda (ex.: o ícone da insígnia). */
  art?: ReactNode;
  title: string;
  /** Liberado (cadeado aberto) ou bloqueado (cadeado fechado). */
  unlocked: boolean;
  /** Texto ao lado do cadeado: "Conquistada", "Bloqueada", "Disponível para todos"... */
  status: string;
  /** Requisito: o que foi feito (liberado) ou o que falta fazer (bloqueado). */
  children?: ReactNode;
};

/** Conteúdo das dicas do catálogo do perfil: nome, cadeado (aberto ou fechado) e o requisito. */
export function UnlockInfo({ art, title, unlocked, status, children }: Props) {
  const Icon = unlocked ? LockOpen : Lock;
  return (
    <span className="flex items-start gap-2.5">
      {art}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold text-text-primary">{title}</span>
        <span
          data-lock={unlocked ? "open" : "closed"}
          className={`inline-flex items-center gap-1 font-medium ${unlocked ? "text-status-success" : "text-text-muted"}`}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {status}
        </span>
        {children}
      </span>
    </span>
  );
}

/** "Publicar 5 projetos" vira "publicar 5 projetos", para caber no meio da frase. */
export function lowerFirst(text: string) {
  return text.charAt(0).toLocaleLowerCase("pt-BR") + text.slice(1);
}
