import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { QuestionForm } from "@/components/studies/question-form";
import { getViewer } from "@/lib/auth/viewer";
import { getSupabaseEnv } from "@/lib/env";
import { decodeSlug, getQuestion } from "@/lib/studies/queries";
import { editQuestion } from "../../actions";

export const metadata: Metadata = { title: "Editar pergunta · Devsync" };

type Params = PageProps<"/estudos/[slug]/editar">["params"];

export default function EditQuestionPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
        <EditQuestion params={params} />
      </Suspense>
    </main>
  );
}

async function EditQuestion({ params }: { params: Params }) {
  const slug = decodeSlug((await params).slug);
  await connection();
  if (!getSupabaseEnv() || !slug) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(`/estudos/${slug}/editar`)}`);
  const question = await getQuestion(slug);
  if (!question) notFound();
  // Só o autor edita: os outros voltam para a pergunta.
  if (question.authorId !== viewer.id) redirect(`/estudos/${question.slug}`);
  const t = await getTranslations("Studies");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-text-primary">{t("editQuestionTitle")}</h1>
        <p className="text-sm text-text-muted">{t("editHelp")}</p>
      </header>
      <QuestionForm
        action={editQuestion.bind(null, question.id, question.slug)}
        initial={{ title: question.title, body: question.bodyMd, tags: question.tags }}
        cancelHref={`/estudos/${question.slug}`}
        mode="edit"
      />
    </div>
  );
}
