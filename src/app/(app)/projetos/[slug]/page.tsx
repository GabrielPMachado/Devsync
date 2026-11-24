import { ArrowLeft, CalendarDays, CircleCheck, Globe, Lock, Maximize2, Package, Play } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DemoFrame } from "@/components/demo/demo-frame";
import { StatusBadge } from "@/components/demo/status-badge";
import { ReportButton } from "@/components/moderation/report-button";
import { Comments } from "@/components/projects/comments";
import { LikeButton } from "@/components/projects/like-button";
import { Markdown } from "@/components/projects/markdown";
import { GithubIcon } from "@/components/icons/github";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { TagChip } from "@/components/ui/tag-chip";
import { getViewer } from "@/lib/auth/viewer";
import { buildCommentTree } from "@/lib/comments/tree";
import { demoFrameSrc, demosBaseUrl } from "@/lib/demos/url";
import { getComments, getProject, hasLiked } from "@/lib/projects/queries";

type Props = PageProps<"/projetos/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [project, t] = await Promise.all([getProject(slug), getTranslations("Projects")]);
  return { title: project ? t("metaProject", { title: project.title }) : t("notFoundTitle") };
}

export default function ProjectPage({ params, searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-bg-surface" />}>
        <Project params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Project({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const project = await getProject(slug);
  if (!project) notFound();
  const [viewer, comments, t, demoT, format] = await Promise.all([getViewer(), getComments(project.id), getTranslations("Projects"), getTranslations("Demo"), getFormatter()]);
  const liked = viewer ? await hasLiked(project.id, viewer.id) : false;
  const path = `/projetos/${project.slug}`;
  const name = project.author.displayName || project.author.username || "?";
  const demo = project.demo;
  const src = demo?.status === "live" ? demoFrameSrc(demo, demosBaseUrl()) : null;
  const openHref = demo ? `${path}?demo=${demo.id}` : null;
  const published = format.dateTime(new Date(project.createdAt), { day: "numeric", month: "short", year: "numeric" });

  return (
    <article className="flex flex-col gap-7">
      {query.publicado === "1" ? (
        <p role="status" className="flex items-center gap-2 self-center rounded-lg border border-status-success/40 bg-status-success-soft px-4 py-2.5 text-sm font-semibold text-status-success-text">
          <CircleCheck className="size-4" aria-hidden="true" />
          {t("published")}
        </p>
      ) : null}
      <nav aria-label={t("breadcrumb")} className="flex items-center gap-2 text-sm">
        <ArrowLeft className="size-4 text-icon-muted" aria-hidden="true" />
        <Link href="/projetos" className="text-text-link">
          {t("title")}
        </Link>
        <span className="text-text-subtle">/</span>
        <span className="truncate text-text-muted">{project.title}</span>
      </nav>

      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-text-primary md:text-3xl">{project.title}</h1>
            {demo ? <StatusBadge status={demo.status} /> : null}
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={name} src={project.author.avatarUrl} size="md" />
            <div className="leading-tight">
              {project.author.username ? (
                <Link href={`/@${project.author.username}`} className="text-sm font-semibold text-text-primary hover:text-text-link">
                  {name}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-text-primary">{name}</span>
              )}
              <p className="text-xs text-text-muted">{t("byline", { username: project.author.username ?? "", date: published })}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {viewer?.id !== project.authorId ? <ReportButton target="project" targetId={project.id} signedIn={!!viewer?.username} /> : null}
          <LikeButton projectId={project.id} path={path} liked={liked} count={project.likesCount} signedIn={!!viewer?.username} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label={t("demoPreview")} className="overflow-hidden rounded-xl border border-border-default bg-bg-elevated">
            <div className="flex items-center gap-2 border-b border-border-default py-2.5 pr-3 pl-4">
              {[0, 1, 2].map((i) => (
                <span key={i} aria-hidden="true" className="size-2.5 rounded-full bg-border-strong" />
              ))}
              <span className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-sm bg-bg-base px-2.5 py-1 font-mono text-xs text-text-muted">
                <Lock className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{src ? new URL(src).host : "—"}</span>
              </span>
              {openHref && src ? (
                <Link href={openHref} scroll={false} aria-label={t("openDemo")} className="flex size-8 items-center justify-center rounded-md text-icon-muted hover:bg-bg-hover hover:text-icon-default">
                  <Maximize2 className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
            <div className="aspect-[16/9] bg-bg-base">
              {src ? (
                <DemoFrame src={src} title={demoT("frameTitle", { title: project.title })} preview />
              ) : (
                <p className="flex size-full items-center justify-center px-6 text-center text-sm text-text-muted">{t("noDemo")}</p>
              )}
            </div>
          </section>
          {openHref && src ? (
            <div className="flex flex-wrap items-center gap-4">
              <Link href={openHref} scroll={false} className={buttonClasses({ size: "lg" })}>
                <Play className="size-4" aria-hidden="true" />
                {t("openDemo")}
              </Link>
              <p className="text-sm text-text-muted">{t("openDemoHint")}</p>
            </div>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold text-text-primary">{t("about")}</h2>
            {project.description ? <Markdown text={project.description} /> : <p className="text-sm text-text-muted">{t("noDescription")}</p>}
          </section>

          <hr className="border-border-default" />
          <Comments projectId={project.id} path={path} nodes={buildCommentTree(comments)} total={project.commentsCount} viewerId={viewer?.username ? viewer.id : null} />
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title={t("info")}>
            {project.repoUrl ? <Info icon={<GithubIcon className="size-4" />} label={t("code")} value={<ExternalLink href={project.repoUrl} />} /> : null}
            {project.siteUrl ? <Info icon={<Globe className="size-4" />} label={t("site")} value={<ExternalLink href={project.siteUrl} />} /> : null}
            {demo ? (
              <Info
                icon={<Package className="size-4" />}
                label={t("demo")}
                value={
                  <span className="rounded-full border border-border-strong bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                    {demo.kind === "web_upload" ? demoT("kindUpload", { version: demo.version }) : demoT("kindLink")}
                  </span>
                }
              />
            ) : null}
            <Info icon={<CalendarDays className="size-4" />} label={t("publishedOn")} value={<span className="text-sm text-text-secondary">{published}</span>} />
          </Panel>
          {project.tags.length > 0 ? (
            <Panel title={t("tech")}>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <TagChip key={tag} name={tag} />
                ))}
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-xl border border-border-default bg-bg-surface p-5">
      <h2 className="font-display text-base font-bold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-icon-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="text-text-muted">{label}</span>
      <span className="ml-auto min-w-0 truncate">{value}</span>
    </div>
  );
}

/** Link do autor para fora (código, site). Mesma guia, sem passar reputação. */
function ExternalLink({ href }: { href: string }) {
  const label = href.replace(/^https:\/\//, "").replace(/\/$/, "");
  return (
    <a href={href} rel="nofollow ugc noopener" className="text-sm text-text-link hover:underline">
      {label}
    </a>
  );
}
