"use client";

import { ShieldAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { reportContent } from "@/lib/moderation/actions";
import { REPORT_DETAILS_MAX, REPORT_REASONS, type ReportReason, type ReportTarget } from "@/lib/moderation/rules";

type Props = { target: ReportTarget; targetId: string; signedIn: boolean; className?: string };

const TRIGGER = "flex items-center gap-1 text-xs text-text-muted hover:text-text-primary";

/** "Denunciar" discreto. Abre um diálogo com motivos prontos e detalhes opcionais. */
export function ReportButton({ target, targetId, signedIn, className = "" }: Props) {
  const t = useTranslations("Report");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const label = t("buttonLabel", { what: t(`targets.${target}`) });

  if (!signedIn) {
    return (
      <Link href={`/entrar?next=${encodeURIComponent(pathname)}`} aria-label={label} className={`${TRIGGER} ${className}`}>
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        {t("button")}
      </Link>
    );
  }
  return (
    <>
      <button type="button" aria-label={label} onClick={() => setOpen(true)} className={`${TRIGGER} ${className}`}>
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        {t("button")}
      </button>
      {open ? <ReportDialog target={target} targetId={targetId} title={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReportDialog({ target, targetId, title, onClose }: { target: ReportTarget; targetId: string; title: string; onClose: () => void }) {
  const t = useTranslations("Report");
  const id = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const needsDetails = reason === "other";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="w-full max-w-md rounded-xl border border-border-default bg-bg-elevated p-5 text-left shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Não deixa o Esc fechar também a camada de demo por baixo.
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={`${id}-title`} className="font-display text-lg font-bold text-text-primary">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("close")} className="rounded-md p-1 text-icon-muted hover:bg-bg-hover hover:text-icon-default">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {done ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="text-sm text-status-success-text">
              {t("done")}
            </p>
            <button type="button" autoFocus onClick={onClose} className={`${buttonClasses({ variant: "secondary" })} self-end`}>
              {t("close")}
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason) return;
              start(async () => {
                const res = await reportContent(target, targetId, reason, details);
                if ("ok" in res) setDone(true);
                else setError(t(`errors.${res.error}`));
              });
            }}
          >
            <p className="text-sm text-text-muted">{t("intro")}</p>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-semibold text-text-primary">{t("reasonLegend")}</legend>
              {REPORT_REASONS.map((key, i) => (
                <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-hover">
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={key}
                    autoFocus={i === 0}
                    checked={reason === key}
                    onChange={() => setReason(key)}
                    className="accent-brand-primary"
                  />
                  {t(`reasons.${key}`)}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-details`} className="text-sm font-semibold text-text-primary">
                {needsDetails ? t("details") : t("detailsOptional")}
              </label>
              <textarea
                id={`${id}-details`}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required={needsDetails}
                rows={3}
                maxLength={REPORT_DETAILS_MAX}
                placeholder={t("detailsPlaceholder")}
                className="resize-y rounded-md border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle focus:border-border-focus focus:outline-none"
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-status-danger-text">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost" })}>
                {t("cancel")}
              </button>
              <button type="submit" disabled={!reason || pending || (needsDetails && !details.trim())} className={buttonClasses()}>
                {pending ? t("sending") : t("submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
