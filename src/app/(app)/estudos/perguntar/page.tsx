import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Gate } from "@/components/auth/gate";
import { QuestionForm } from "@/components/studies/question-form";
import { askQuestion } from "../actions";

export const metadata: Metadata = { title: "Fazer pergunta · Devsync" };

export default async function AskPage() {
  const t = await getTranslations("Studies");
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 gap-10 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={null}>
        <Gate area="private" next="/estudos/perguntar" />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-text-primary md:text-3xl">{t("askTitle")}</h1>
          <p className="text-base text-text-muted">{t("askSubtitle")}</p>
        </header>
        <QuestionForm action={askQuestion} cancelHref="/estudos" mode="ask" />
      </div>
      <aside className="hidden w-64 shrink-0 lg:block">
        <section className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="font-display text-sm font-bold text-text-primary">{t("goodQuestionTitle")}</h2>
          <ul className="flex flex-col gap-2.5">
            {(["good1", "good2", "good3", "good4"] as const).map((key) => (
              <li key={key} className="flex items-center gap-2.5 text-sm text-text-secondary">
                <Check className="size-4 shrink-0 text-brand-accent" aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </main>
  );
}
