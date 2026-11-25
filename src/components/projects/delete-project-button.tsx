"use client";

import { LoaderCircle, Trash2, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";

type Remove = (projectId: string) => Promise<{ error: "notFound" | "unknown" }>;

function isRedirect(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;");
}

/** "Excluir" do dono do projeto, com confirmação. Deu certo: a ação leva para /projetos. */
export function DeleteProjectButton({ projectId, title, remove }: { projectId: string; title: string; remove: Remove }) {
  const t = useTranslations("Projects");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("deleteProject")} className={buttonClasses({ variant: "ghost", size: "sm" })}>
        <Trash2 className="size-4 text-status-danger-text" aria-hidden="true" />
        {t("delete")}
      </button>
      {open ? <ConfirmDialog projectId={projectId} title={title} remove={remove} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ConfirmDialog({ projectId, title, remove, onClose }: { projectId: string; title: string; remove: Remove; onClose: () => void }) {
  const t = useTranslations("Projects");
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Foco começa no "Cancelar": Enter sem querer não exclui.
  useEffect(() => cancelRef.current?.focus(), []);
  const close = () => {
    if (!pending) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        className="w-full max-w-md rounded-xl border border-border-default bg-bg-elevated p-5 text-left shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={`${id}-title`} className="flex items-center gap-2 font-display text-lg font-bold text-text-primary">
            <TriangleAlert className="size-5 shrink-0 text-status-danger-text" aria-hidden="true" />
            <span className="min-w-0 break-words">{t("deleteTitle", { title })}</span>
          </h2>
          <button type="button" onClick={close} aria-label={t("deleteClose")} className="rounded-md p-1 text-icon-muted hover:bg-bg-hover hover:text-icon-default">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p id={`${id}-text`} className="text-sm text-text-secondary">
          {t("deleteText")}
        </p>
        {error ? (
          <p role="alert" className="mt-4 rounded-md border border-status-danger/50 bg-status-danger-soft px-3 py-2 text-sm text-status-danger-text">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" onClick={close} disabled={pending} className={`${buttonClasses({ variant: "ghost" })} justify-center`}>
            {t("deleteCancel")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  const result = await remove(projectId);
                  setError(result.error === "notFound" ? t("deleteNotFound") : t("deleteError"));
                } catch (err) {
                  // Excluiu: o Next já está indo para /projetos.
                  if (isRedirect(err)) return;
                  setError(t("deleteError"));
                }
              })
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-status-danger px-4 text-sm font-semibold text-white transition-colors hover:bg-status-danger/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
            {pending ? t("deleting") : t("deleteConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
