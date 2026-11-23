import { Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { QuestionCard } from "@/components/studies/question-card";
import { buttonClasses } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";
import { getSupabaseEnv } from "@/lib/env";
import { listQuestions, popularTags, type ListTab } from "@/lib/studies/queries";

export const metadata: Metadata = { title: "Estudos · Devsync" };

type SearchParams = PageProps<"/estudos">["searchParams"];

const TABS: { key: ListTab; param: string | null; label: "tabRecent" | "tabUnanswered" | "tabFollowing" }[] = [
  { key: "recent", param: null, label: "tabRecent" },
  { key: "unanswered", param: "sem-resposta", label: "tabUnanswered" },
  { key: "following", param: "minhas-tags", label: "tabFollowing" },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hrefFor({ tab, tag, page }: { tab?: string | null; tag?: string | null; page?: number }) {
  const q = new URLSearchParams();
  if (tab) q.set("aba", tab);
  if (tag) q.set("tag", tag);
  if (page && page > 1) q.set("pagina", String(page));
  const s = q.toString();
  return s ? `/estudos?${s}` : "/estudos";
}

export default async function StudiesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("Studies");
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 gap-8 px-4 py-6 md:px-6 md:py-8">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <header className="flex items-start gap-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <h1 className="font-display text-2xl font-bold text-text-primary md:text-3xl">{t("title")}</h1>
            <p className="text-sm text-text-muted">{t("subtitle")}</p>
          </div>
          <Link href="/estudos/perguntar" className={buttonClasses()}>
            <Plus className="size-4" aria-hidden="true" />
            {t("ask")}
          </Link>
        </header>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
          <QuestionList searchParams={searchParams} />
        </Suspense>
      </div>
      <aside className="hidden w-60 shrink-0 flex-col gap-5 lg:flex">
        <section className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="font-display text-sm font-bold text-text-primary">{t("tipsTitle")}</h2>
          <ol className="flex flex-col gap-2.5">
            {(["tip1", "tip2", "tip3"] as const).map((key, i) => (
              <li key={key} className="flex gap-2.5 text-sm text-text-secondary">
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary-soft text-[11px] font-semibold text-brand-accent">{i + 1}</span>
                {t(key)}
              </li>
            ))}
          </ol>
        </section>
        <section className="flex flex-col gap-1.5 rounded-xl border border-brand-accent/40 bg-brand-accent-soft p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-accent">
            <Sparkles className="size-4" aria-hidden="true" />
            {t("beginnerTitle")}
          </h2>
          <p className="text-sm text-text-secondary">{t("beginnerText")}</p>
        </section>
      </aside>
    </main>
  );
}

async function QuestionList({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await connection();
  const t = await getTranslations("Studies");
  const tabParam = first(params.aba) ?? null;
  const tab = TABS.find((x) => x.param === tabParam) ?? TABS[0];
  const tag = first(params.tag)?.toLowerCase() || null;
  const page = Math.min(Math.max(Number.parseInt(first(params.pagina) ?? "1", 10) || 1, 1), 20);

  const viewer = getSupabaseEnv() ? await getViewer() : null;
  const tabs = viewer?.username ? TABS : TABS.filter((x) => x.key !== "following");
  const [{ questions, hasMore }, tags] = getSupabaseEnv()
    ? await Promise.all([listQuestions({ tab: tab.key, tag: tag ?? undefined, page, viewerId: viewer?.id }), popularTags()])
    : [{ questions: [], hasMore: false }, []];
  const chipTags = tag && !tags.includes(tag) ? [tag, ...tags] : tags;
  const now = new Date();
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
      on ? "border-brand-accent bg-brand-accent-soft text-brand-accent" : "border-border-default text-text-muted hover:border-border-strong hover:text-text-primary"
    }`;

  return (
    <>
      <nav aria-label={t("tabsLabel")} className="flex gap-1 border-b border-border-default">
        {tabs.map((x) => {
          const on = x.key === tab.key;
          return (
            <Link
              key={x.key}
              href={hrefFor({ tab: x.param, tag })}
              aria-current={on ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                on ? "border-brand-accent text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              {t(x.label)}
            </Link>
          );
        })}
      </nav>
      {chipTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Link href={hrefFor({ tab: tab.param })} className={chip(!tag)}>
            {t("allTags")}
          </Link>
          {chipTags.map((slug) => (
            <Link key={slug} href={hrefFor({ tab: tab.param, tag: slug })} className={chip(tag === slug)} aria-current={tag === slug ? "page" : undefined}>
              {slug}
            </Link>
          ))}
        </div>
      ) : null}
      {questions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-default px-6 py-12 text-center">
          <p className="font-display text-lg font-bold text-text-primary">{t("emptyTitle")}</p>
          <p className="max-w-md text-sm text-text-muted">{tab.key === "following" ? t("emptyFollowing") : t("emptyText")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} now={now} />
          ))}
        </div>
      )}
      {hasMore ? (
        <div className="flex justify-center">
          <Link href={hrefFor({ tab: tab.param, tag, page: page + 1 })} scroll={false} className={buttonClasses({ variant: "secondary" })}>
            {t("loadMore")}
          </Link>
        </div>
      ) : null}
    </>
  );
}
