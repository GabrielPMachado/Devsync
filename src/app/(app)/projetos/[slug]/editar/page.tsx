import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gate } from "@/components/auth/gate";
import { EditProjectForm } from "@/components/projects/edit-project-form";
import { getViewer } from "@/lib/auth/viewer";
import { getProject, listTags } from "@/lib/projects/queries";
import { updateProject } from "../../actions";

type Props = PageProps<"/projetos/[slug]/editar">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("EditProject");
  return { title: t("metaTitle") };
}

export default function EditProjectPage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
        <Edit params={params} />
      </Suspense>
    </main>
  );
}

async function Edit({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const path = `/projetos/${slug}/editar`;
  const [project, viewer, tags, t] = await Promise.all([getProject(slug), getViewer(), listTags(), getTranslations("EditProject")]);
  // Sem login: o Gate leva para /entrar e volta aqui. Projeto de outra pessoa: 404.
  if (!viewer) return <Gate area="private" next={path} />;
  if (!project || project.authorId !== viewer.id) notFound();
  return (
    <>
      <Gate area="private" next={path} />
      <nav className="flex items-center gap-2 text-sm">
        <ArrowLeft className="size-4 text-icon-muted" aria-hidden="true" />
        <Link href={`/projetos/${project.slug}`} className="truncate text-text-link">
          {project.title}
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold text-text-primary">{t("title")}</h1>
        <p className="text-text-muted">{t("subtitle")}</p>
      </header>
      <EditProjectForm
        project={{ id: project.id, slug: project.slug, title: project.title, description: project.description, tags: project.tags, repoUrl: project.repoUrl, siteUrl: project.siteUrl, coverUrl: project.coverUrl ?? null }}
        tags={tags}
        save={updateProject}
      />
    </>
  );
}
