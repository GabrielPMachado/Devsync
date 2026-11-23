import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Markdown } from "@/components/studies/markdown";
import { getSupabaseEnv } from "@/lib/env";
import { decodeSlug, getAnswer, getQuestion, getRevisions } from "@/lib/studies/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Histórico · Devsync" };

type Props = PageProps<"/estudos/[slug]/historico">;

export default function HistoryPage(props: Props) {
  return (
    <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
        <History {...props} />
      </Suspense>
    </main>
  );
}

async function History({ params, searchParams }: Props) {
  const slug = decodeSlug((await params).slug);
  const answerParam = (await searchParams).resposta;
  const answerId = typeof answerParam === "string" ? answerParam : null;
  await connection();
  if (!getSupabaseEnv() || !slug) notFound();
  const question = await getQuestion(slug);
  if (!question) notFound();
  const t = await getTranslations("Studies");
  const format = await getFormatter();

  let heading = t("historyOf", { title: question.title });
  let current: { title: string | null; body: string };
  let revisions;
  if (answerId) {
    const answer = await getAnswer(answerId);
    if (!answer || answer.question_id !== question.id) notFound();
    const supabase = await createClient();
    const { data: author } = await supabase.from("profiles").select("username").eq("id", answer.author_id).maybeSingle();
    heading = t("historyAnswer", { username: (author?.username as string | undefined) ?? "?" });
    current = { title: null, body: answer.body_md };
    revisions = await getRevisions("answer", answer.id);
  } else {
    current = { title: question.title, body: question.bodyMd };
    revisions = await getRevisions("question", question.id);
  }

  const version = (label: string, title: string | null, body: string | null, key: string) => (
    <section key={key} className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-5">
      <h2 className="text-xs font-semibold tracking-wide text-text-muted uppercase">{label}</h2>
      {title ? <p className="font-display text-lg font-bold text-text-primary">{title}</p> : null}
      {body ? <Markdown source={body} /> : null}
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/estudos/${question.slug}${answerId ? `#resposta-${answerId}` : ""}`} className="text-sm text-text-link hover:underline">
        {t("backToQuestion")}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-text-primary">{t("historyTitle")}</h1>
        <p className="text-sm text-text-muted">{heading}</p>
      </header>
      {version(t("historyCurrent"), current.title, current.body, "atual")}
      {revisions.length === 0 ? (
        <p className="text-sm text-text-muted">{t("historyEmpty")}</p>
      ) : (
        revisions.map((r) =>
          version(t("historyVersion", { when: format.dateTime(new Date(r.createdAt), { dateStyle: "medium", timeStyle: "short" }) }), r.title, r.bodyMd, r.id),
        )
      )}
    </div>
  );
}
