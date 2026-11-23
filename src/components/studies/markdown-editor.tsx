"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Markdown } from "./markdown";

type Props = {
  name: string;
  label?: string;
  help?: string;
  error?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
};

/** Campo de Markdown com abas Escrever / Visualizar (o mesmo render da página). */
export function MarkdownEditor({ name, label, help, error, placeholder, value, onChange, minRows = 8 }: Props) {
  const t = useTranslations("Studies");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const id = useId();
  const noteId = `${id}-nota`;
  const note = error ?? help;
  const tabClass = (on: boolean) =>
    `rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors ${on ? "bg-bg-hover text-text-primary" : "text-text-muted hover:text-text-primary"}`;

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold text-text-secondary">
          {label}
        </label>
      ) : null}
      <div className={`rounded-md border bg-bg-base focus-within:border-border-focus ${error ? "border-status-danger" : "border-border-default"}`}>
        <div className="flex justify-end gap-1 border-b border-border-default px-2 py-1.5">
          <button type="button" className={tabClass(tab === "write")} aria-pressed={tab === "write"} onClick={() => setTab("write")}>
            {t("write")}
          </button>
          <button type="button" className={tabClass(tab === "preview")} aria-pressed={tab === "preview"} onClick={() => setTab("preview")}>
            {t("preview")}
          </button>
        </div>
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          aria-label={label ? undefined : placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={`block w-full resize-y bg-transparent px-3 py-2.5 font-mono text-sm text-text-primary placeholder:font-sans placeholder:text-text-subtle focus:outline-none ${tab === "write" ? "" : "hidden"}`}
        />
        {tab === "preview" ? (
          <div className="min-h-32 px-4 py-3">
            {value.trim() ? <Markdown source={value} /> : <p className="text-sm text-text-subtle">{t("previewEmpty")}</p>}
          </div>
        ) : null}
      </div>
      {note ? (
        <p id={noteId} className={`text-xs ${error ? "text-status-danger-text" : "text-text-muted"}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
