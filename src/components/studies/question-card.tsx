import { CircleCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { QuestionSummary } from "@/lib/studies/queries";
import { StudyTag } from "./study-tag";

/** Card da lista de Estudos: respostas, título, resumo, tags e autor. Sem votos (pergunta não recebe voto). */
export function QuestionCard({ question, now }: { question: QuestionSummary; now: Date }) {
  const t = useTranslations("Studies");
  const format = useFormatter();
  const name = question.author.displayName || question.author.username || "?";
  const answers = question.answersCount;
  const badge = question.hasAccepted
    ? "border-status-success bg-status-success-soft text-status-success-text"
    : answers === 0
      ? "border-status-warning bg-status-warning-soft text-status-warning-text"
      : "border-border-strong bg-bg-elevated text-text-secondary";

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4 transition-colors hover:border-border-strong md:flex-row md:gap-5 md:p-5">
      <div className="shrink-0 md:w-28">
        <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold ${badge}`}>
          {question.hasAccepted ? <CircleCheck className="size-3.5" aria-hidden="true" /> : null}
          {t("answers", { count: answers })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 className="font-display text-base font-semibold text-text-link">
          <Link href={`/estudos/${question.slug}`} className="hover:underline">
            {question.title}
          </Link>
        </h2>
        {question.excerpt ? <p className="line-clamp-2 text-sm text-text-muted">{question.excerpt}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {question.tags.map((slug) => (
              <StudyTag key={slug} slug={slug} />
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Avatar name={name} src={question.author.avatarUrl} size="xs" />
            <span>
              <span className="font-semibold text-text-secondary">{name}</span>{" "}
              {t("asked", { when: format.relativeTime(new Date(question.createdAt), now) })}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
