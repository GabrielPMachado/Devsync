"use client";

import { CornerDownRight, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { addComment, deleteComment } from "@/app/(app)/projetos/actions";
import { ReportButton } from "@/components/moderation/report-button";
import { ToneWarning } from "@/components/moderation/tone-warning";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import type { CommentNode, CommentRow } from "@/lib/comments/tree";
import { Markdown } from "./markdown";

type Props = { projectId: string; path: string; nodes: CommentNode[]; total: number; viewerId: string | null };

/** Comentários do projeto em 2 níveis (comentário e respostas). */
export function Comments({ projectId, path, nodes, total, viewerId }: Props) {
  const t = useTranslations("Comments");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  return (
    <section id="comentarios" className="flex scroll-mt-24 flex-col gap-5">
      <h2 className="font-display text-lg font-bold text-text-primary">{t("title", { count: total })}</h2>
      {viewerId ? (
        <CommentForm projectId={projectId} path={path} parentId={null} label={t("label")} submit={t("submit")} />
      ) : (
        <Link href={`/entrar?next=${encodeURIComponent(path)}`} className={`${buttonClasses({ variant: "secondary" })} self-start`}>
          {t("signIn")}
        </Link>
      )}
      {nodes.length === 0 ? <p className="text-sm text-text-muted">{t("empty")}</p> : null}
      <ul className="flex flex-col gap-5">
        {nodes.map((c) => (
          <li key={c.id} className="flex flex-col gap-3">
            <CommentItem comment={c} path={path} viewerId={viewerId} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} />
            {c.replies.length > 0 || replyTo === c.id ? (
              <ul className="ml-11 flex flex-col gap-3">
                {c.replies.map((r) => (
                  <li key={r.id}>
                    <CommentItem comment={r} path={path} viewerId={viewerId} onReply={() => setReplyTo(c.id)} />
                  </li>
                ))}
                {replyTo === c.id && viewerId ? (
                  <li>
                    <CommentForm
                      projectId={projectId}
                      path={path}
                      parentId={c.id}
                      label={t("replyLabel", { name: c.author.displayName || c.author.username || "?" })}
                      submit={t("sendReply")}
                      onDone={() => setReplyTo(null)}
                      autoFocus
                    />
                  </li>
                ) : null}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentItem({ comment: c, path, viewerId, onReply }: { comment: CommentRow; path: string; viewerId: string | null; onReply: () => void }) {
  const t = useTranslations("Comments");
  const format = useFormatter();
  const router = useRouter();
  const [pending, start] = useTransition();
  const name = c.author.displayName || c.author.username || "?";
  return (
    <div className={`flex gap-3 ${pending ? "opacity-50" : ""}`}>
      <Avatar name={name} src={c.author.avatarUrl} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-text-muted">
          <span className="text-sm font-semibold text-text-primary">{name}</span>
          {c.author.username ? <span className="font-mono">@{c.author.username}</span> : null}
          <span>· {format.relativeTime(new Date(c.createdAt))}</span>
        </p>
        <Markdown text={c.bodyMd} className="text-sm" />
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {viewerId ? (
            <button type="button" onClick={onReply} className="flex items-center gap-1 hover:text-text-primary">
              <CornerDownRight className="size-3.5" aria-hidden="true" />
              {t("reply")}
            </button>
          ) : null}
          {viewerId !== c.authorId ? <ReportButton target="comment" targetId={c.id} signedIn={!!viewerId} /> : null}
          {viewerId === c.authorId ? (
            <button
              type="button"
              aria-label={t("delete")}
              className="flex items-center gap-1 hover:text-status-danger-text"
              onClick={() =>
                start(async () => {
                  await deleteComment(c.id, path);
                  router.refresh();
                })
              }
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommentForm(props: { projectId: string; path: string; parentId: string | null; label: string; submit: string; onDone?: () => void; autoFocus?: boolean }) {
  const t = useTranslations("Comments");
  const router = useRouter();
  const id = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toneWarning, setToneWarning] = useState(false);
  const [pending, start] = useTransition();
  const send = (confirmTone: boolean) =>
    start(async () => {
      const res = await addComment(props.projectId, body, props.parentId, props.path, confirmTone);
      if (res.toneWarning) return setToneWarning(true);
      setToneWarning(false);
      if (res.error) return setError(res.error === "empty" ? t("empty_error") : res.error === "tooLong" ? t("tooLong") : t("unknown"));
      setBody("");
      setError(null);
      props.onDone?.();
      router.refresh();
    });
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {props.label}
      </label>
      <div className="flex items-start gap-3">
        <textarea
          id={id}
          name="comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={props.parentId ? 2 : 3}
          maxLength={5000}
          autoFocus={props.autoFocus}
          placeholder={t("placeholder")}
          className="min-h-11 flex-1 resize-y rounded-md border border-border-strong bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-subtle focus:border-border-focus focus:outline-none"
        />
        <button type="submit" className={buttonClasses({ variant: "secondary" })} disabled={pending}>
          {pending ? t("sending") : props.submit}
        </button>
      </div>
      {toneWarning && !pending ? (
        <ToneWarning
          onRevise={() => {
            setToneWarning(false);
            document.getElementById(id)?.focus();
          }}
          confirm={{ kind: "button", onClick: () => send(true) }}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-status-danger-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}
