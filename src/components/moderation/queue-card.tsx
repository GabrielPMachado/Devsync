"use client";

import { Ban, Copy, Eye, EyeOff, ExternalLink, RotateCcw, UserX, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { markDuplicate, moderate, type AdminResult, type ModerationAction } from "@/lib/moderation/actions";
import type { QueueItem } from "@/lib/moderation/queries";

const HIDEABLE = new Set(["project", "question", "answer", "comment"]);

/** Um item da fila do /admin: tudo o que foi denunciado sobre um mesmo conteúdo. */
export function QueueCard({ item, mode }: { item: QueueItem; mode: "open" | "resolved" }) {
  const t = useTranslations("Admin");
  const format = useFormatter();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const removed = !item.path && !item.title && !item.preview;
  const open = mode === "open";

  const run = (call: () => Promise<AdminResult>) =>
    start(async () => {
      const res = await call();
      if ("error" in res) return setError(t(`errors.${res.error}`));
      setError(null);
      router.refresh();
    });
  const act = (action: ModerationAction) => run(() => moderate({ target: item.targetType, targetId: item.targetId, action, authorId: item.author?.id ?? null }));

  const buttons: { action: ModerationAction; icon: ReactNode; danger?: boolean }[] = [];
  if (HIDEABLE.has(item.targetType) && !removed) {
    if (item.hidden) buttons.push({ action: "unhide", icon: <Eye className="size-4" /> });
    else if (open) buttons.push({ action: "hide", icon: <EyeOff className="size-4" />, danger: true });
  }
  if (item.targetType === "demo" && !removed) {
    if (item.demoStatus === "blocked") buttons.push({ action: "unblockDemo", icon: <RotateCcw className="size-4" /> });
    else if (open) buttons.push({ action: "blockDemo", icon: <Ban className="size-4" />, danger: true });
  }
  if (item.author) {
    if (item.author.suspended) buttons.push({ action: "unsuspendAuthor", icon: <RotateCcw className="size-4" /> });
    else if (open) buttons.push({ action: "suspendAuthor", icon: <UserX className="size-4" />, danger: true });
  }
  if (open) buttons.push({ action: "dismiss", icon: <X className="size-4" /> });

  const when = (iso: string) => format.relativeTime(new Date(iso));

  return (
    <article className={`flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4 md:p-5 ${pending ? "opacity-60" : ""}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span className="rounded-sm bg-bg-elevated px-2 py-0.5 font-semibold text-text-secondary">{t(`types.${item.targetType}`)}</span>
        <span className="font-semibold text-status-danger-text">{t("reportCount", { count: item.reportCount })}</span>
        <span>{open || !item.resolvedAt ? t("lastReported", { when: when(item.lastReportedAt) }) : t("resolvedAt", { when: when(item.resolvedAt) })}</span>
        {item.hidden && item.targetType !== "demo" ? <Badge>{t("hidden")}</Badge> : null}
        {item.demoStatus === "blocked" ? <Badge>{t("demoBlocked")}</Badge> : null}
        {item.author?.suspended ? <Badge>{t("authorSuspended")}</Badge> : null}
        {item.path ? (
          <Link href={item.path} className="ml-auto flex items-center gap-1 text-text-link hover:underline">
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {t("open")}
          </Link>
        ) : null}
      </header>

      {removed ? (
        <p className="text-sm text-text-muted italic">{t("removed")}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {item.title ? <h3 className="font-semibold text-text-primary break-words">{item.title}</h3> : null}
          {item.preview ? <p className="line-clamp-4 text-sm whitespace-pre-line text-text-secondary break-words">{item.preview}</p> : null}
          {item.author?.username ? <p className="text-xs text-text-muted">{t("by", { username: item.author.username })}</p> : null}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">{t("reasons")}</h4>
        <ul className="flex flex-col gap-0.5 text-sm text-text-secondary">
          {item.reasons.map((r, i) => (
            <li key={i} className="break-words">
              {r}
            </li>
          ))}
        </ul>
      </div>

      {open && item.targetType === "question" && !removed ? <DuplicateForm disabled={pending} onSubmit={(original) => run(() => markDuplicate(item.targetId, original))} /> : null}

      {error ? (
        <p role="alert" className="text-sm text-status-danger-text">
          {error}
        </p>
      ) : null}

      {buttons.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-border-default pt-3">
          {buttons.map((b) => (
            <button
              key={b.action}
              type="button"
              disabled={pending}
              onClick={() => act(b.action)}
              className={`${buttonClasses({ variant: b.danger ? "secondary" : "ghost", size: "sm" })} ${b.danger ? "text-status-danger-text" : ""}`}
            >
              <span aria-hidden="true">{b.icon}</span>
              {t(`actions.${b.action}`)}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-sm border border-status-danger/40 bg-status-danger-soft px-1.5 py-0.5 text-status-danger-text">{children}</span>;
}

function DuplicateForm({ onSubmit, disabled }: { onSubmit: (original: string) => void; disabled: boolean }) {
  const t = useTranslations("Admin");
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value);
      }}
    >
      <label htmlFor={id} className="text-xs font-semibold text-text-muted">
        {t("duplicate.label")}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("duplicate.placeholder")}
        className="h-8 min-w-0 flex-1 rounded-md border border-border-strong bg-bg-base px-2.5 text-sm text-text-primary placeholder:text-text-subtle focus:border-border-focus focus:outline-none"
      />
      <button type="submit" disabled={disabled || !value.trim()} className={buttonClasses({ variant: "ghost", size: "sm" })}>
        <Copy className="size-4" aria-hidden="true" />
        {t("duplicate.submit")}
      </button>
    </form>
  );
}
