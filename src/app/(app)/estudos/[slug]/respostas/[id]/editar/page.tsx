import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AnswerForm } from "@/components/studies/answer-form";
import { getViewer } from "@/lib/auth/viewer";
import { getSupabaseEnv } from "@/lib/env";
import { decodeSlug, getAnswer, getQuestion } from "@/lib/studies/queries";
import { editAnswer } from "../../../../actions";

export const metadata: Metadata = { title: "Editar resposta · Devsync" };

type Params = PageProps<"/estudos/[slug]/respostas/[id]/editar">["params"];

export default function EditAnswerPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
        <EditAnswer params={params} />
      </Suspense>
    </main>
  );
}

async function EditAnswer({ params }: { params: Params }) {
  const { slug: raw, id } = await params;
  const slug = decodeSlug(raw);
  await connection();
  if (!getSupabaseEnv() || !slug) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(`/estudos/${slug}/respostas/${id}/editar`)}`);
  const [question, answer] = await Promise.all([getQuestion(slug), getAnswer(id)]);
  if (!question || !answer || answer.question_id !== question.id) notFound();
  if (answer.author_id !== viewer.id) redirect(`/estudos/${question.slug}`);
  const t = await getTranslations("Studies");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href={`/estudos/${question.slug}`} className="text-sm text-text-link hover:underline">
          {question.title}
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">{t("editAnswerTitle")}</h1>
        <p className="text-sm text-text-muted">{t("editHelp")}</p>
      </header>
      <AnswerForm
        action={editAnswer.bind(null, answer.id, question.slug)}
        initial={{ body: answer.body_md, techVersion: answer.tech_version }}
        cancelHref={`/estudos/${question.slug}#resposta-${answer.id}`}
      />
    </div>
  );
}
