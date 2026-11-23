import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  help?: ReactNode;
  error?: ReactNode;
  /** Cor da ajuda quando ela é uma boa notícia (ex.: "@ana está disponível"). */
  helpTone?: "muted" | "success";
  prefix?: string;
};

export function TextField({ label, help, error, helpTone = "muted", prefix, id, className = "", ...input }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-nota`;
  const note = error ?? help;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-semibold text-text-secondary">
        {label}
      </label>
      <div
        className={`flex items-center rounded-md border bg-bg-base transition-colors focus-within:border-border-focus ${
          error ? "border-status-danger" : "border-border-default"
        }`}
      >
        {prefix ? <span className="pl-3 font-mono text-sm text-text-subtle">{prefix}</span> : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={`h-11 w-full rounded-md bg-transparent text-sm text-text-primary placeholder:text-text-subtle focus:outline-none ${
            prefix ? "pr-3 pl-1" : "px-3"
          }`}
          {...input}
        />
      </div>
      {note ? (
        <p
          id={noteId}
          className={`text-xs ${error ? "text-status-danger-text" : helpTone === "success" ? "text-status-success-text" : "text-text-muted"}`}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
