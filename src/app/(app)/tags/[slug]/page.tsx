import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProjectCard } from "@/components/projects/project-card";
import { TagFollowButton } from "@/components/social/tag-follow-button";
import { QuestionCard } from "@/components/studies/question-card";
import { getViewer } from "@/lib/auth/viewer";
import { getTagPage } from "@/lib/social/queries";

type Params = PageProps<"/tags/[slug]">["params"];

function slugOf(raw: string) {
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slugOf(slug)} · Devsync` };
}

export default function TagPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-8 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-bg-surface" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: Params }) {
  const slug = slugOf((await params).slug);
  const viewer = await getViewer();
  const tag = slug ? await getTagPage(slug, viewer?.id) : null;
  if (!tag) notFound();
  const t = await getTranslations("Discover");
  const now = new Date();
  return (
    <>
      <header className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-brand-accent uppercase">{t("tag")}</p>
          <h1 className="font-mono text-2xl font-bold text-text-primary md:text-3xl">{tag.slug}</h1>
          {tag.description ? <p className="max-w-2xl text-base text-text-muted">{tag.description}</p> : null}
        </div>
        <TagFollowButton slug={tag.slug} followed={tag.followed} signedIn={!!viewer?.username} />
      </header>
      <section aria-labelledby="t-projetos" className="flex flex-col gap-4">
        <h2 id="t-projetos" className="font-display text-lg font-bold text-text-primary">{t("projectsTitle")}</h2>
        {tag.projects.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tag.projects.map((p) => (
              <ProjectCard key={p.id} project={p} basePath={`/tags/${tag.slug}`} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t("noProjects")}</p>
        )}
      </section>
      <section aria-labelledby="t-perguntas" className="flex flex-col gap-4">
        <h2 id="t-perguntas" className="font-display text-lg font-bold text-text-primary">{t("questionsTitle")}</h2>
        {tag.questions.length ? tag.questions.map((q) => <QuestionCard key={q.id} question={q} now={now} />) : <p className="text-sm text-text-muted">{t("noQuestions")}</p>}
      </section>
    </>
  );
}
