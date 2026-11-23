import { ChevronDown, ChevronUp, CircleCheck, Flag, History, Pencil, TrendingUp, TriangleAlert, Clock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { acceptAnswer, toggleOutdated, voteAnswer } from "@/app/(app)/estudos/actions";
import { Avatar } from "@/components/ui/avatar";
import type { AnswerView } from "@/lib/studies/queries";
import { answerNotice, displayScore } from "@/lib/studies/rules";
import { Markdown } from "./markdown";

type Props = {
  answer: AnswerView;
  question: { id: string; slug: string; authorId: string; acceptedAnswerId: string | null };
  viewerId: string | null;
  recentTop: boolean;
  now: Date;
};

/**
 * Uma resposta: votos à esquerda, selos (aceita, mais votada recentemente),
 * avisos de resposta antiga, texto e rodapé com ações. As ações são formulários
 * com Server Actions, então funcionam até antes de o JavaScript carregar.
 */
export function AnswerCard({ answer, question, viewerId, recentTop, now }: Props) {
  const t = useTranslations("Studies");
  const format = useFormatter();
  const accepted = question.acceptedAnswerId === answer.id;
  const mine = viewerId === answer.authorId;
  const askedByMe = viewerId === question.authorId;
  const notice = answerNotice(answer, now);
  const name = answer.author.displayName || answer.author.username || "?";
  const signIn = `/entrar?next=${encodeURIComponent(`/estudos/${question.slug}`)}`;
  const shown = displayScore(answer.score);
  const ghost = "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary";
  const voteBtn = (on: boolean) =>
    `flex size-8 items-center justify-center rounded-md transition-colors ${on ? "bg-brand-accent-soft text-brand-accent" : "text-icon-muted hover:bg-bg-hover hover:text-icon-default"}`;

  const vote = (value: 1 | -1) => {
    const on = answer.myVote === value;
    const Icon = value === 1 ? ChevronUp : ChevronDown;
    const label = on ? t("removeVote") : value === 1 ? t("upvote") : t("downvote");
    if (mine) return null;
    if (!viewerId) {
      return (
        <Link href={signIn} className={voteBtn(false)} aria-label={label}>
          <Icon className="size-5" aria-hidden="true" />
        </Link>
      );
    }
    return (
      <form action={voteAnswer.bind(null, answer.id, on ? 0 : value, question.slug)}>
        <button type="submit" className={voteBtn(on)} aria-label={label} aria-pressed={on}>
          <Icon className="size-5" aria-hidden="true" />
        </button>
      </form>
    );
  };

  return (
    <article
      id={`resposta-${answer.id}`}
      aria-label={t("answerBy", { name })}
      className={`flex gap-3 rounded-xl border p-4 md:gap-4 md:p-5 ${
        accepted ? "border-status-success bg-status-success-soft/30" : "border-border-default bg-bg-surface"
      }`}
    >
      <div className="flex w-8 shrink-0 flex-col items-center gap-1">
        {vote(1)}
        <span className={`font-display text-lg font-bold ${answer.score < 0 ? "text-text-subtle" : "text-text-primary"}`} aria-label={t("score")}>
          {shown}
        </span>
        {vote(-1)}
        {accepted ? <CircleCheck className="mt-1 size-5 text-status-success" aria-label={t("accepted")} /> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {accepted || recentTop || notice ? (
          <div className="flex flex-wrap gap-2">
            {accepted ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-status-success bg-status-success-soft px-2 py-0.5 text-xs font-semibold text-status-success-text">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                {t("accepted")}
              </span>
            ) : null}
            {recentTop ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-brand-accent bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">
                <TrendingUp className="size-3.5" aria-hidden="true" />
                {t("recentTop")}
              </span>
            ) : null}
            {notice ? (
              <span
                className="inline-flex items-center gap-1 rounded-sm border border-status-warning bg-status-warning-soft px-2 py-0.5 text-xs font-semibold text-status-warning-text"
                title={notice === "old" ? t("oldNoticeText") : undefined}
              >
                <Clock className="size-3.5" aria-hidden="true" />
                {t("oldNotice")}
              </span>
            ) : null}
          </div>
        ) : null}

        {notice === "flagged" ? (
          <p role="note" className="flex items-start gap-2 rounded-lg border border-status-warning bg-status-warning-soft px-3 py-2 text-sm text-status-warning-text">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {answer.techVersion
              ? t("flaggedNoticeVersion", { version: answer.techVersion, count: answer.outdatedFlags })
              : t("flaggedNotice", { count: answer.outdatedFlags })}
          </p>
        ) : null}

        <Markdown source={answer.bodyMd} />

        <div className="flex flex-wrap items-center gap-1">
          {askedByMe ? (
            <form action={acceptAnswer.bind(null, question.id, accepted ? null : answer.id, question.slug)}>
              <button type="submit" className={`${ghost} ${accepted ? "" : "text-status-success-text"}`}>
                <CircleCheck className="size-4" aria-hidden="true" />
                {accepted ? t("unaccept") : t("accept")}
              </button>
            </form>
          ) : null}
          {viewerId && !mine ? (
            <form action={toggleOutdated.bind(null, answer.id, !answer.flaggedByMe, question.slug)}>
              <button type="submit" className={ghost} aria-pressed={answer.flaggedByMe}>
                <Flag className="size-4" aria-hidden="true" />
                {answer.flaggedByMe ? t("outdatedUndo") : t("outdated")}
              </button>
            </form>
          ) : null}
          {mine ? (
            <Link href={`/estudos/${question.slug}/respostas/${answer.id}/editar`} className={ghost}>
              <Pencil className="size-4" aria-hidden="true" />
              {t("edit")}
            </Link>
          ) : null}
          {answer.edited ? (
            <Link href={`/estudos/${question.slug}/historico?resposta=${answer.id}`} className={ghost}>
              <History className="size-4" aria-hidden="true" />
              {t("history")}
            </Link>
          ) : null}
          {answer.techVersion ? (
            <span className="ml-1 rounded-sm border border-border-default px-2 py-0.5 font-mono text-xs text-text-muted">{answer.techVersion}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-2 text-xs text-text-muted">
            <Avatar name={name} src={answer.author.avatarUrl} size="sm" />
            <div className="flex flex-col">
              {answer.author.username ? (
                <Link href={`/@${answer.author.username}`} className="font-semibold text-text-secondary hover:underline">
                  {name}
                </Link>
              ) : (
                <span className="font-semibold text-text-secondary">{name}</span>
              )}
              <time dateTime={answer.createdAt}>
                {format.dateTime(new Date(answer.createdAt), { day: "numeric", month: "short", year: "numeric" })}
              </time>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
