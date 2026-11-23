"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { QuestionFormState } from "@/app/(app)/estudos/actions";
import { buttonClasses } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { TITLE_MAX } from "@/lib/studies/rules";
import { MarkdownEditor } from "./markdown-editor";

type Props = {
  action: (state: QuestionFormState, formData: FormData) => Promise<QuestionFormState>;
  initial?: { title: string; body: string; tags: string[] };
  cancelHref: string;
  mode: "ask" | "edit";
};

const TITLE_ERRORS = { short: "errorTitleShort", long: "errorTitleLong" } as const;
const BODY_ERRORS = { required: "errorBodyRequired", long: "errorBodyLong" } as const;
const TAG_ERRORS = { min: "errorTagsMin", max: "errorTagsMax" } as const;

export function QuestionForm({ action, initial, cancelHref, mode }: Props) {
  const t = useTranslations("Studies");
  const [state, formAction, pending] = useActionState(action, {});
  const [body, setBody] = useState(initial?.body ?? "");
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-5 rounded-xl border border-border-default bg-bg-surface p-5 md:p-6">
        <TextField
          label={t("fieldTitle")}
          name="title"
          defaultValue={initial?.title}
          maxLength={TITLE_MAX}
          help={t("fieldTitleHelp")}
          error={errors.title ? t(TITLE_ERRORS[errors.title]) : undefined}
          required
        />
        <MarkdownEditor
          name="body"
          label={t("fieldBody")}
          help={t("fieldBodyHelp")}
          error={errors.body ? t(BODY_ERRORS[errors.body]) : undefined}
          value={body}
          onChange={setBody}
          minRows={10}
        />
        <TextField
          label={t("fieldTags")}
          name="tags"
          defaultValue={initial?.tags.join(", ")}
          placeholder={t("fieldTagsPlaceholder")}
          help={t("fieldTagsHelp")}
          error={errors.tags ? t(TAG_ERRORS[errors.tags]) : undefined}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {errors.form ? (
        <p role="alert" className="text-sm text-status-danger-text">
          {t("errorUnknown")}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Link href={cancelHref} className={buttonClasses({ variant: "ghost" })}>
          {t("cancel")}
        </Link>
        <button type="submit" disabled={pending} className={`${buttonClasses()} ml-auto`}>
          <Send className="size-4" aria-hidden="true" />
          {pending ? t("saving") : mode === "ask" ? t("publishQuestion") : t("save")}
        </button>
      </div>
    </form>
  );
}
