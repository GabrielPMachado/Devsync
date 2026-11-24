import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { ProjectCard } from "@/components/projects/project-card";
import { buttonClasses } from "@/components/ui/button";
import { listProjects } from "@/lib/projects/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Projects");
  return { title: t("metaTitle") };
}

export default async function ProjectsPage() {
  const t = await getTranslations("Projects");
  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">{t("title")}</h1>
          <p className="text-text-muted">{t("subtitle")}</p>
        </div>
        <Link href="/projetos/novo" className={buttonClasses()}>
          <Plus className="size-4" aria-hidden="true" />
          {t("publish")}
        </Link>
      </header>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-bg-surface" />}>
        <List />
      </Suspense>
    </main>
  );
}

async function List() {
  const [projects, t] = await Promise.all([listProjects(), getTranslations("Projects")]);
  if (projects.length === 0) return <p className="rounded-xl border border-dashed border-border-default px-4 py-12 text-center text-sm text-text-muted">{t("empty")}</p>;
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} basePath="/projetos" />
      ))}
    </div>
  );
}
