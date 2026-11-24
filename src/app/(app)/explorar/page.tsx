import { CircleHelp, Flame, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { ProjectCard } from "@/components/projects/project-card";
import { SearchBox } from "@/components/social/search-box";
import { WhoToFollow } from "@/components/social/side-panels";
import { QuestionCard } from "@/components/studies/question-card";
import { getViewer } from "@/lib/auth/viewer";
import { client, trendingProjects, unansweredQuestions } from "@/lib/social/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Discover");
  return { title: `${t("exploreTitle")} · Devsync` };
}

export default async function ExplorePage() {
  const t = await getTranslations("Discover");
  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-8 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-bold text-text-primary md:text-3xl">{t("exploreTitle")}</h1>
        <p className="text-base text-text-muted">{t("exploreSubtitle")}</p>
        <SearchBox className="h-11 w-full" />
      </header>
      <Suspense fallback={null}>
        <PopularTags />
      </Suspense>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-bg-surface" />}>
        <Sections />
      </Suspense>
    </main>
  );
}

/** Tags com mais conteúdo (perguntas + projetos), para começar a acompanhar. */
async function PopularTags() {
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.from("tags").select("slug, question_tags(count), project_tags(count)").limit(300);
  type T = { slug: string; question_tags: { count: number }[]; project_tags: { count: number }[] };
  const tags = ((data ?? []) as unknown as T[])
    .map((x) => ({ slug: x.slug, n: (x.question_tags[0]?.count ?? 0) + (x.project_tags[0]?.count ?? 0) }))
    .sort((a, b) => b.n - a.n || a.slug.localeCompare(b.slug))
    .slice(0, 16);
  const t = await getTranslations("Discover");
  return (
    <nav aria-label={t("popularTags")} className="flex flex-wrap gap-2">
      {tags.map((x) => (
        <Link key={x.slug} href={`/tags/${x.slug}`} className="rounded-full border border-border-default bg-bg-surface px-3 py-1.5 font-mono text-xs text-text-secondary hover:border-brand-primary hover:text-text-primary">
          {x.slug}
        </Link>
      ))}
    </nav>
  );
}

async function Sections() {
  const [viewer, projects, questions] = await Promise.all([getViewer(), trendingProjects(6), unansweredQuestions(4)]);
  const t = await getTranslations("Discover");
  const now = new Date();
  const title = (Icon: typeof Flame, text: string, id: string) => (
    <h2 id={id} className="flex items-center gap-2 font-display text-lg font-bold text-text-primary">
      <Icon className="size-5 text-brand-accent" aria-hidden="true" />
      {text}
    </h2>
  );
  return (
    <>
      <section aria-labelledby="em-alta" className="flex flex-col gap-4">
        {title(Flame, t("trending"), "em-alta")}
        {projects.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} basePath="/explorar" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t("noProjects")}</p>
        )}
      </section>
      <div className="flex flex-col gap-8 lg:flex-row">
        <section aria-labelledby="esperando" className="flex min-w-0 flex-1 flex-col gap-4">
          {title(CircleHelp, t("waitingAnswer"), "esperando")}
          {questions.length ? questions.map((q) => <QuestionCard key={q.id} question={q} now={now} />) : <p className="text-sm text-text-muted">{t("allAnswered")}</p>}
        </section>
        <section aria-labelledby="pessoas" className="flex flex-col gap-4 lg:w-80">
          {title(Users, t("peopleToFollow"), "pessoas")}
          <WhoToFollow viewerId={viewer?.id ?? null} path="/explorar" limit={5} showBio title={t("suggestions")} />
        </section>
      </div>
    </>
  );
}
