"use client";

import { Send, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { AnswerFormState } from "@/app/(app)/estudos/actions";
import { buttonClasses } from "@/components/ui/button";
import { ToneWarning } from "@/components/moderation/tone-warning";
import { TextField } from "@/components/ui/text-field";
import { TECH_VERSION_MAX } from "@/lib/studies/rules";
import { MarkdownEditor } from "./markdown-editor";

type Props = {
  action: (state: AnswerFormState, formData: FormData) => Promise<AnswerFormState>;
  initial?: { body: string; techVersion: string | null };
  beginner?: boolean;
  cancelHref?: string;
};

const BODY_ERRORS = { required: "errorAnswerRequired", long: "errorBodyLong" } as const;

/** Formulário "Sua resposta" (e o de editar resposta, com cancelHref). */
export function AnswerForm({ action, initial, beginner, cancelHref }: Props) {
  const t = useTranslations("Studies");
  const [state, formAction, pending] = useActionState(action, {});
  const [body, setBody] = useState(initial?.body ?? "");
  const [version, setVersion] = useState(initial?.techVersion ?? "");
  const [published, setPublished] = useState(0);
  // Aviso de tom dispensado ("Revisar texto"): guarda qual resposta do servidor foi dispensada.
  const [revising, setRevising] = useState<AnswerFormState | null>(null);
  const errors = state.errors ?? {};
  const toneWarning = state.toneWarning && revising !== state && !pending;

  // Publicou: limpa o formulário (ajuste de estado durante o render, sem efeito).
  if (state.ok && state.ok !== published) {
    setPublished(state.ok);
    setBody("");
    setVersion("");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-surface p-5 md:p-6" noValidate>
      {cancelHref ? null : <h2 className="font-display text-lg font-bold text-text-primary">{t("yourAnswer")}</h2>}
      {beginner ? (
        <p className="flex items-start gap-2 rounded-lg border border-brand-accent/40 bg-brand-accent-soft px-3 py-2 text-sm text-text-secondary">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-accent" aria-hidden="true" />
          {t("beginnerReminder")}
        </p>
      ) : null}
      <MarkdownEditor
        name="body"
        label={cancelHref ? t("yourAnswer") : undefined}
        placeholder={t("answerPlaceholder")}
        error={errors.body ? t(BODY_ERRORS[errors.body]) : undefined}
        value={body}
        onChange={setBody}
        minRows={7}
      />
      <TextField
        label={t("techVersion")}
        name="techVersion"
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        maxLength={TECH_VERSION_MAX}
        placeholder={t("techVersionPlaceholder")}
        help={t("techVersionHelp")}
        error={errors.techVersion ? t("errorTechVersionLong") : undefined}
        className="md:max-w-sm"
      />
      {errors.form ? (
        <p role="alert" className="text-sm text-status-danger-text">
          {t("errorUnknown")}
        </p>
      ) : null}
      {toneWarning ? (
        <ToneWarning
          pending={pending}
          onRevise={() => {
            setRevising(state);
            document.getElementsByName("body")[0]?.focus();
          }}
          confirm={{ kind: "submit", name: "confirmTone", value: "1" }}
        />
      ) : null}
      {state.ok && !pending && !state.toneWarning ? (
        <p role="status" className="text-sm text-status-success-text">
          {t("answerPublished")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-text-muted">{t("beGentle")}</p>
        {cancelHref ? (
          <Link href={cancelHref} className={buttonClasses({ variant: "ghost" })}>
            {t("cancel")}
          </Link>
        ) : null}
        <button type="submit" disabled={pending || !body.trim()} className={buttonClasses()}>
          <Send className="size-4" aria-hidden="true" />
          {pending ? t("publishing") : cancelHref ? t("save") : t("publishAnswer")}
        </button>
      </div>
    </form>
  );
}
