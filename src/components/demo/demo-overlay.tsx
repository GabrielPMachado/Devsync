"use client";

import { Ban, LoaderCircle, Maximize2, MessageCircle, Minimize2, Monitor, RotateCw, Smartphone, Tablet, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ReportButton } from "@/components/moderation/report-button";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { demoFrameSrc, demosBaseUrl, type DemoKind, type DemoStatus } from "@/lib/demos/url";
import { createClient } from "@/lib/supabase/client";
import { DemoFrame } from "./demo-frame";
import { StatusBadge } from "./status-badge";

export type DemoView = {
  id: string;
  kind: DemoKind;
  status: DemoStatus;
  url: string | null;
  project: { title: string; slug: string; author: { username: string | null; displayName: string | null; avatarUrl: string | null } } | null;
  /** Quem vê está logado (mostra "Denunciar" em vez do link para entrar). */
  signedIn?: boolean;
  /** Quem vê é o dono da demo (não vê "Denunciar"). */
  mine?: boolean;
};

/** Lê a demo e o projeto dela com o Supabase do navegador. null quando a RLS esconde (suspensa, apagada). */
export async function loadDemoView(demoId: string): Promise<DemoView | null> {
  const supabase = createClient();
  const [{ data: demo }, { data: project }, { data: session }] = await Promise.all([
    supabase.from("demos").select("id, kind, status, url, owner_id").eq("id", demoId).maybeSingle(),
    supabase.from("projects").select("title, slug, author:profiles!projects_author_id_fkey(username, display_name, avatar_url)").eq("demo_id", demoId).limit(1).maybeSingle(),
    supabase.auth.getSession(),
  ]);
  if (!demo) return null;
  const { owner_id: ownerId, ...row } = demo as Omit<DemoView, "project" | "signedIn" | "mine"> & { owner_id: string };
  const viewerId = session.session?.user.id ?? null;
  const p = project as unknown as { title: string; slug: string; author: { username: string | null; display_name: string | null; avatar_url: string | null } | null } | null;
  return {
    ...row,
    signedIn: !!viewerId,
    mine: viewerId === ownerId,
    project: p
      ? { title: p.title, slug: p.slug, author: { username: p.author?.username ?? null, displayName: p.author?.display_name ?? null, avatarUrl: p.author?.avatar_url ?? null } }
      : null,
  };
}

const WIDTHS = { desktop: null, tablet: "820px", phone: "390px" } as const;
type Width = keyof typeof WIDTHS;
const PENDING_POLL_MS = 2_000;
/** Depois disso para de consultar e fica em "Preparando" (a pessoa pode recarregar). */
const PENDING_MAX_MS = 90_000;

type Props = { demoId: string; onClose: () => void; load?: (demoId: string) => Promise<DemoView | null> };

/**
 * Camada de demo: abre por cima da página atual, nunca em outra guia.
 * Esc, X e clique no fundo fecham. Contrato do roteiro: <DemoOverlay demoId onClose />.
 */
export function DemoOverlay({ demoId, onClose, load = loadDemoView }: Props) {
  const t = useTranslations("Demo");
  const [state, setState] = useState<{ loading: true } | { loading: false; view: DemoView | null }>({ loading: true });
  const [width, setWidth] = useState<Width>("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Carrega e, enquanto a demo estiver "pending", consulta de novo.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const run = async () => {
      const view = await load(demoId).catch(() => null);
      if (!alive) return;
      setState({ loading: false, view });
      if (view?.status === "pending" && Date.now() - started < PENDING_MAX_MS) timer = setTimeout(run, PENDING_POLL_MS);
    };
    void run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [demoId, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    const onFs = () => setFullscreen(document.fullscreenElement === rootRef.current && !!rootRef.current);
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }, []);

  const view = state.loading ? null : state.view;
  const title = view?.project?.title ?? t("dialogFallback");
  const src = view?.status === "live" ? demoFrameSrc(view, demosBaseUrl()) : null;
  const icon = "flex size-9 items-center justify-center rounded-md text-icon-muted hover:bg-bg-hover hover:text-icon-default disabled:opacity-40";

  return (
    <div
      ref={rootRef}
      data-testid="demo-backdrop"
      className={`fixed inset-0 z-50 flex bg-bg-base/85 backdrop-blur-sm ${fullscreen ? "p-0" : "p-0 md:px-10 md:py-8"}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex min-h-0 w-full flex-col overflow-hidden border-border-strong bg-bg-surface shadow-2xl ${fullscreen ? "" : "md:rounded-2xl md:border"}`}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-default bg-bg-elevated pr-2 pl-3 md:h-15 md:pl-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {view?.project ? <Avatar name={view.project.author.displayName || view.project.author.username || "?"} src={view.project.author.avatarUrl} size="sm" /> : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
              {view?.project?.author.username ? <p className="truncate text-xs text-text-muted">{t("by", { username: view.project.author.username })}</p> : null}
            </div>
            {view ? <StatusBadge status={view.status} /> : null}
          </div>
          <div role="group" aria-label={t("widths")} className={`hidden items-center gap-0.5 rounded-[10px] border border-border-default bg-bg-surface p-0.5 md:flex ${src ? "" : "opacity-35"}`}>
            {(
              [
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["phone", Smartphone],
              ] as const
            ).map(([w, Icon]) => (
              <button
                key={w}
                type="button"
                aria-label={t(w)}
                aria-pressed={width === w}
                disabled={!src}
                onClick={() => setWidth(w)}
                className={`flex size-8 items-center justify-center rounded-md ${width === w ? "bg-bg-hover text-brand-accent" : "text-icon-muted hover:text-icon-default"}`}
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1">
            <button type="button" className={icon} aria-label={t("reload")} disabled={!src} onClick={() => setReloadKey((k) => k + 1)}>
              <RotateCw className="size-4" aria-hidden="true" />
            </button>
            <button type="button" className={icon} aria-label={fullscreen ? t("exitFullscreen") : t("fullscreen")} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
            </button>
            {view?.project ? (
              <Link href={`/projetos/${view.project.slug}#comentarios`} className={icon} aria-label={t("comments")}>
                <MessageCircle className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
            {view && !view.mine ? <ReportButton target="demo" targetId={view.id} signedIn={!!view.signedIn} className="h-8 rounded-md px-2" /> : null}
            <span className="mx-1 hidden h-6 w-px bg-border-default md:block" aria-hidden="true" />
            <kbd className="hidden rounded-sm border border-border-default px-1.5 font-mono text-[11px] text-text-muted md:inline">Esc</kbd>
            <button ref={closeRef} type="button" className={icon} aria-label={t("close")} onClick={onClose}>
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-stretch justify-center bg-bg-base">
          {state.loading ? (
            <Message icon={<LoaderCircle className="size-7 animate-spin text-brand-accent" aria-hidden="true" />} title={t("loading")} />
          ) : src ? (
            <div className="size-full transition-[max-width]" style={{ maxWidth: WIDTHS[width] ?? "100%" }}>
              <DemoFrame src={src} title={t("frameTitle", { title })} reloadKey={reloadKey} />
            </div>
          ) : view?.status === "pending" ? (
            <Message icon={<LoaderCircle className="size-7 animate-spin text-brand-accent" aria-hidden="true" />} title={t("pendingTitle")} text={t("pendingText")} />
          ) : (
            <Message
              icon={view?.status === "blocked" ? <Ban className="size-7 text-status-danger" aria-hidden="true" /> : <TriangleAlert className="size-7 text-status-warning" aria-hidden="true" />}
              title={view?.status === "blocked" ? t("blockedTitle") : t("unavailableTitle")}
              text={view?.status === "blocked" ? t("blockedText") : view ? t("unavailableText") : t("missingText")}
            >
              {view?.project ? (
                <Link href={`/projetos/${view.project.slug}`} className={buttonClasses({ variant: "secondary" })}>
                  {t("projectPage")}
                </Link>
              ) : null}
              <button type="button" className={buttonClasses({ variant: "ghost" })} onClick={onClose}>
                {t("closeShort")}
              </button>
            </Message>
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full border border-border-default bg-bg-elevated">{icon}</span>
      <h2 className="font-display text-xl font-bold text-text-primary">{title}</h2>
      {text ? <p className="text-sm text-text-muted">{text}</p> : null}
      {children ? <div className="flex gap-3">{children}</div> : null}
    </div>
  );
}
