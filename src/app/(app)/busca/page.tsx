import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { ProjectCard } from "@/components/projects/project-card";
import { PersonRow } from "@/components/social/person-row";
import { SearchBox } from "@/components/social/search-box";
import { QuestionCard } from "@/components/studies/question-card";
import { getViewer } from "@/lib/auth/viewer";
import { followingSet, search } from "@/lib/social/queries";
import { parseSearch, type SearchQuery, type SearchTipo } from "@/lib/social/search-params";

type Search = PageProps<"/busca">["searchParams"];

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const t = await getTranslations("Discover");
  const { q } = parseSearch(await searchParams);
  return { title: `${q ? t("searchTitleFor", { q }) : t("searchTitle")} · Devsync`, robots: { index: false } };
}

export default function SearchPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-bg-surface" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const TIPOS: SearchTipo[] = ["tudo", "projetos", "perguntas", "pessoas"];

function hrefFor(query: SearchQuery, change: Partial<{ tipo: SearchTipo; tag: string | null }>) {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  const tipo = change.tipo ?? query.tipo;
  if (tipo !== "tudo") p.set("tipo", tipo);
  const tag = "tag" in change ? change.tag : query.tag;
  if (tag) p.set("tag", tag);
  return `/busca?${p}`;
}

async function Results({ searchParams }: { searchParams: Search }) {
  const query = parseSearch(await searchParams);
  const t = await getTranslations("Discover");
  const [viewer, results] = await Promise.all([getViewer(), search(query.q, query.kinds, query.tag)]);
  const follows = await followingSet(viewer?.id, results.people.map((p) => p.id));
  const total = results.projects.length + results.questions.length + results.people.length;
  const now = new Date();
  const path = hrefFor(query, {});

  return (
    <>
      <h1 className="sr-only">{t("searchTitle")}</h1>
      <SearchBox key={query.q} initial={query.q} className="h-11 w-full" />
      {query.q ? (
        <p className="text-base text-text-muted" role="status">
          {t.rich("resultsFor", { count: total, q: query.q, b: (c) => <strong className="text-text-primary">{c}</strong> })}
        </p>
      ) : (
        <p className="text-base text-text-muted">{t("searchHint")}</p>
      )}
      <nav aria-label={t("filterBy")} className="flex flex-wrap items-center gap-2">
        {TIPOS.map((tipo) => {
          const on = tipo === query.tipo;
          return (
            <Link key={tipo} href={hrefFor(query, { tipo })} aria-current={on ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand-primary bg-brand-primary-soft text-text-primary" : "border-border-default bg-bg-surface text-text-secondary hover:text-text-primary"}`}>
              {t(`tipo_${tipo}`)}
            </Link>
          );
        })}
        {query.tag ? (
          <Link href={hrefFor(query, { tag: null })} className="rounded-full border border-brand-accent bg-brand-accent-soft px-3 py-1.5 font-mono text-xs text-brand-accent" aria-label={t("removeTag", { tag: query.tag })}>
            {query.tag} ×
          </Link>
        ) : null}
      </nav>

      {query.q && total === 0 ? <p className="rounded-xl border border-dashed border-border-default px-4 py-12 text-center text-sm text-text-muted">{t("noResults")}</p> : null}

      {results.projects.length ? (
        <section aria-labelledby="r-projetos" className="flex flex-col gap-4">
          <h2 id="r-projetos" className="font-display text-lg font-bold text-text-primary">{t("projects", { count: results.projects.length })}</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.projects.map((p) => (
              <ProjectCard key={p.id} project={p} basePath="/busca" />
            ))}
          </div>
        </section>
      ) : null}
      {results.questions.length ? (
        <section aria-labelledby="r-perguntas" className="flex flex-col gap-4">
          <h2 id="r-perguntas" className="font-display text-lg font-bold text-text-primary">{t("questions", { count: results.questions.length })}</h2>
          {results.questions.map((q) => (
            <QuestionCard key={q.id} question={q} now={now} />
          ))}
        </section>
      ) : null}
      {results.people.length ? (
        <section aria-labelledby="r-pessoas" className="flex flex-col gap-4">
          <h2 id="r-pessoas" className="font-display text-lg font-bold text-text-primary">{t("people", { count: results.people.length })}</h2>
          <ul className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-surface p-4">
            {results.people.map((p) => (
              <li key={p.id}>
                <PersonRow person={p} following={follows.has(p.id)} viewerId={viewer?.id ?? null} path={path} showBio />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
