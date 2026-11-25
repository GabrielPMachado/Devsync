import { Heart, MessageCircle, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { StatusBadge } from "@/components/demo/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { TagChip } from "@/components/ui/tag-chip";
import type { ProjectCardData } from "@/lib/projects/queries";

/**
 * Card de projeto (Figma "Card de projeto"). "Ver demo" abre a camada por
 * cima da página atual (`basePath?demo=<id>`), nunca outra guia.
 */
export function ProjectCard({ project: p, basePath }: { project: ProjectCardData; basePath: string }) {
  const t = useTranslations("Projects");
  const name = p.author.displayName || p.author.username || "?";
  const live = p.demo?.status === "live";
  // Capa do autor; sem ela, o print automático da demo; sem os dois, o desenho padrão.
  const image = p.coverUrl || p.demo?.screenshotUrl || null;
  // O print da demo mostra o topo da página; a capa fica centralizada.
  const position = p.coverUrl ? "object-center" : "object-top";
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border-default bg-bg-surface transition-colors hover:border-border-strong">
      <div className="relative h-40 overflow-hidden bg-[linear-gradient(135deg,rgb(37_99_235/0.45),rgb(34_211_238/0.12))]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem do Storage ou do serviço de demos
          <img src={image} alt={t("coverOf", { title: p.title })} loading="lazy" decoding="async" className={`absolute inset-0 size-full object-cover ${position}`} />
        ) : (
          <div aria-hidden="true" className="absolute inset-x-8 top-8 bottom-0 rounded-t-lg border border-b-0 border-border-strong bg-bg-base/90 p-3">
            <div className="mb-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 rounded-full bg-border-strong" />
              ))}
            </div>
            <div className="mb-2 h-2 w-2/5 rounded-full bg-brand-gradient" />
            <div className="mb-1.5 h-1.5 w-4/5 rounded-full bg-bg-muted" />
            <div className="h-1.5 w-3/5 rounded-full bg-bg-muted" />
          </div>
        )}
        {p.demo ? (
          <span className="absolute top-3 left-3">
            <StatusBadge status={p.demo.status} />
          </span>
        ) : null}
        {live ? (
          <Link
            href={`${basePath}?demo=${p.demo!.id}`}
            scroll={false}
            aria-label={t("viewDemoOf", { title: p.title })}
            className="absolute right-3 bottom-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-primary px-3 text-xs font-semibold text-text-on-brand shadow-lg hover:bg-brand-primary-hover"
          >
            <Play className="size-3.5" aria-hidden="true" />
            {t("viewDemo")}
          </Link>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h2 className="line-clamp-2 font-display text-base font-bold text-text-primary">
          <Link href={`/projetos/${p.slug}`} className="hover:text-text-link">
            {p.title}
          </Link>
        </h2>
        {p.description ? <p className="line-clamp-2 text-sm text-text-muted">{p.description.replace(/[#*`>_[\]]/g, "")}</p> : null}
        {p.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((tag) => (
              <TagChip key={tag} name={tag} />
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Avatar name={name} src={p.author.avatarUrl} size="xs" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold text-text-primary">{name}</p>
            {p.author.username ? <p className="truncate font-mono text-[11px] text-text-muted">@{p.author.username}</p> : null}
          </div>
          <span className="flex items-center gap-1 text-xs text-text-muted" title={t("likes", { count: p.likesCount })}>
            <Heart className="size-3.5" aria-hidden="true" />
            {p.likesCount}
          </span>
          <span className="flex items-center gap-1 text-xs text-text-muted" title={t("commentsCount", { count: p.commentsCount })}>
            <MessageCircle className="size-3.5" aria-hidden="true" />
            {p.commentsCount}
          </span>
        </div>
      </div>
    </article>
  );
}
