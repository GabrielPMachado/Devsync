import { History, Info, Link2, MessageCircle, MessageSquareWarning, Pencil } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReportButton } from "@/components/moderation/report-button";
import { AnswerCard } from "@/components/studies/answer-card";
import { AnswerForm } from "@/components/studies/answer-form";
import { Markdown } from "@/components/studies/markdown";
import { StudyTag } from "@/components/studies/study-tag";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";
import { getSupabaseEnv } from "@/lib/env";
import { decodeSlug, getAnswers, getQuestion, hasRequestedDetails } from "@/lib/studies/queries";
import { pickRecentTop } from "@/lib/studies/rules";
import { postAnswer, toggleDetailRequest } from "../actions";

type Params = PageProps<"/estudos/[slug]">["params"];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  // O título real vem do banco; o slug já é o título em formato de URL.
  const readable = (decodeSlug(slug) ?? "").replace(/-[a-z0-9]{6}$/, "").replaceAll("-", " ");
  return { title: `${readable} · Estudos · Devsync` };
}

export default function QuestionPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
        <Question params={params} />
      </Suspense>
    </main>
  );
}

async function Question({ params }: { params: Params }) {
  const { slug: raw } = await params;
  await connection();
  const slug = decodeSlug(raw);
  if (!getSupabaseEnv() || !slug) notFound();
  const [question, viewer] = await Promise.all([getQuestion(slug), getViewer()]);
  if (!question) notFound();

  const viewerId = viewer?.username ? viewer.id : null;
  const [answers, requested] = await Promise.all([getAnswers(question.id, viewerId), hasRequestedDetails(question.id, viewerId)]);
  const t = await getTranslations("Studies");
  const format = await getFormatter();
  const now = new Date();
  const mine = viewerId === question.authorId;
  const name = question.author.displayName || question.author.username || "?";
  const recentTop = pickRecentTop(answers, question.acceptedAnswerId);
  const ghost = "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary";
  const signIn = `/entrar?next=${encodeURIComponent(`/estudos/${question.slug}`)}`;
  const qRef = { id: question.id, slug: question.slug, authorId: question.authorId, acceptedAnswerId: question.acceptedAnswerId };

  return (
    <article className="flex flex-col gap-6">
      <nav aria-label={t("breadcrumb")} className="flex items-center gap-2 text-sm">
        <Link href="/estudos" className="text-text-link hover:underline">
          {t("title")}
        </Link>
        {question.tags[0] ? (
          <>
            <span className="text-text-subtle">/</span>
            <Link href={`/estudos?tag=${encodeURIComponent(question.tags[0])}`} className="text-text-muted hover:text-text-primary">
              {question.tags[0]}
            </Link>
          </>
        ) : null}
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-bold leading-tight text-text-primary md:text-[28px]">{question.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <Avatar name={name} src={question.author.avatarUrl} size="xs" />
          {question.author.username ? (
            <Link href={`/@${question.author.username}`} className="font-semibold text-text-secondary hover:underline">
              {name}
            </Link>
          ) : (
            <span className="font-semibold text-text-secondary">{name}</span>
          )}
          <span>{t("asked", { when: format.relativeTime(new Date(question.createdAt), now) })}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {question.tags.map((slug) => (
            <StudyTag key={slug} slug={slug} />
          ))}
        </div>
      </header>

      {question.duplicateOf ? (
        <p className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-secondary">
          <Link2 className="size-4 shrink-0 text-brand-accent" aria-hidden="true" />
          <Link href={`/estudos/${question.duplicateOf.slug}`} className="text-text-link hover:underline">
            {t("seeAlso", { title: question.duplicateOf.title })}
          </Link>
        </p>
      ) : null}

      <Markdown source={question.bodyMd} className="text-base" />

      {mine && question.detailRequestsCount > 0 ? (
        <section className="flex flex-col gap-2 rounded-xl border border-status-warning bg-status-warning-soft p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-status-warning-text">
            <MessageSquareWarning className="size-4" aria-hidden="true" />
            {t("detailsTitle", { count: question.detailRequestsCount })}
          </h2>
          <p className="text-sm text-text-secondary">{t("detailsText")}</p>
          <Link href={`/estudos/${question.slug}/editar`} className={`${buttonClasses({ variant: "secondary", size: "sm" })} self-start`}>
            <Pencil className="size-4" aria-hidden="true" />
            {t("detailsEdit")}
          </Link>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 border-b border-border-default pb-4">
        {mine ? (
          <Link href={`/estudos/${question.slug}/editar`} className={ghost}>
            <Pencil className="size-4" aria-hidden="true" />
            {t("edit")}
          </Link>
        ) : viewerId ? (
          <form action={toggleDetailRequest.bind(null, question.id, !requested, question.slug)}>
            <button type="submit" className={ghost} aria-pressed={requested} title={t("needsDetailsHelp")}>
              <MessageCircle className="size-4" aria-hidden="true" />
              {requested ? t("needsDetailsSent") : t("needsDetails")}
            </button>
          </form>
        ) : (
          <Link href={signIn} className={ghost} title={t("needsDetailsHelp")}>
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("needsDetails")}
          </Link>
        )}
        {!mine ? <ReportButton target="question" targetId={question.id} signedIn={!!viewerId} className="h-8 px-2.5" /> : null}
        {question.edited ? (
          <Link href={`/estudos/${question.slug}/historico`} className={ghost}>
            <History className="size-4" aria-hidden="true" />
            {t("history")}
          </Link>
        ) : null}
      </div>

      {answers.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-xl border border-border-default bg-bg-surface px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-accent-soft">
            <MessageCircle className="size-7 text-brand-accent" aria-hidden="true" />
          </span>
          <h2 className="font-display text-lg font-bold text-text-primary">{t("noAnswersTitle")}</h2>
          <p className="max-w-md text-sm text-text-muted">{t("noAnswersText")}</p>
        </section>
      ) : (
        <section className="flex flex-col gap-4" aria-labelledby="respostas">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 id="respostas" className="font-display text-xl font-bold text-text-primary">
              {t("answersTitle", { count: answers.length })}
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-text-muted md:ml-auto">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              {t("orderHelp")}
            </p>
          </div>
          {answers.map((answer) => (
            <AnswerCard key={answer.id} answer={answer} question={qRef} viewerId={viewerId} recentTop={answer.id === recentTop} now={now} />
          ))}
        </section>
      )}

      {viewerId ? (
        <AnswerForm action={postAnswer.bind(null, question.id, question.slug)} beginner={question.tags.includes("iniciante")} />
      ) : (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-bg-surface p-5">
          <p className="min-w-0 flex-1 basis-56 text-sm text-text-secondary">{t("signInToAnswer")}</p>
          <Link href={signIn} className={buttonClasses()}>
            {t("signIn")}
          </Link>
        </section>
      )}
    </article>
  );
}
