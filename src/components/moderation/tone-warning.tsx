"use client";

import { MessageCircleWarning } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";

type Props = {
  onRevise: () => void;
  /** Botão "Publicar assim mesmo": submit com confirmTone=1 (formulário) ou clique (comentário). */
  confirm: { kind: "submit"; name: string; value: string } | { kind: "button"; onClick: () => void };
  pending?: boolean;
};

/** Aviso do filtro de tom: sugere revisar, mas deixa publicar. */
export function ToneWarning({ onRevise, confirm, pending }: Props) {
  const t = useTranslations("Tone");
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-status-warning/40 bg-status-warning-soft px-4 py-3">
      <p className="flex items-start gap-2 text-sm text-text-secondary">
        <MessageCircleWarning className="mt-0.5 size-4 shrink-0 text-status-warning-text" aria-hidden="true" />
        <span>
          <strong className="block text-text-primary">{t("title")}</strong>
          {t("body")}
        </span>
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onRevise} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          {t("revise")}
        </button>
        {confirm.kind === "submit" ? (
          <button type="submit" name={confirm.name} value={confirm.value} disabled={pending} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            {t("publishAnyway")}
          </button>
        ) : (
          <button type="button" onClick={confirm.onClick} disabled={pending} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            {t("publishAnyway")}
          </button>
        )}
      </div>
    </div>
  );
}
