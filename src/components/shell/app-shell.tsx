import { Bell, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";
import { NavLinks, NavLinksView, TabBar, TabBarView } from "./nav-links";
import { UserMenu } from "./user-menu";

/**
 * Moldura do app. Desktop (md+): barra de cima com logo, Início/Projetos/Estudos,
 * busca, sino, Publicar e conta. Celular: barra de cima (logo, busca, +) e 5 abas embaixo.
 * Tudo que depende da sessão fica em <Suspense>; o resto entra no HTML estático.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col pb-20 md:pb-0">{children}</div>
      <Suspense fallback={<TabBarView profileHref="/entrar" pathname="" />}>
        <ViewerTabBar />
      </Suspense>
    </div>
  );
}

function TopBar() {
  const t = useTranslations("Nav");
  const icon = "flex size-9 items-center justify-center rounded-md text-icon-muted hover:bg-bg-hover hover:text-icon-default";
  return (
    <header className="sticky top-0 z-30 border-b border-border-default bg-bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-2 px-3 md:h-16 md:gap-4 md:px-6">
        <Link href="/" aria-label="Devsync" className="shrink-0">
          <Logo size={26} />
        </Link>
        <nav aria-label={t("mainNav")} className="ml-2 hidden md:block">
          <Suspense fallback={<NavLinksView pathname="" />}>
            <NavLinks />
          </Suspense>
        </nav>
        {/* A busca chega no subprojeto 6; por enquanto o campo só mostra onde ela vai ficar. */}
        <div className="mx-auto hidden h-9 w-full max-w-md items-center gap-2 rounded-md border border-border-default bg-bg-base px-3 text-sm text-text-subtle lg:flex" aria-hidden="true">
          <Search className="size-4" />
          <span className="flex-1 truncate">{t("search")}</span>
          <kbd className="rounded-sm border border-border-default px-1.5 font-mono text-[10px]">Ctrl K</kbd>
        </div>
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <button type="button" className={`${icon} lg:hidden`} aria-label={t("searchShort")} disabled>
            <Search className="size-5" aria-hidden="true" />
          </button>
          <Suspense fallback={<div className="size-8" />}>
            <AccountArea />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function AccountArea() {
  const viewer = await getViewer();
  return <AccountButtons viewer={viewer} />;
}

function AccountButtons({ viewer }: { viewer: Awaited<ReturnType<typeof getViewer>> }) {
  const t = useTranslations("Nav");
  const icon = "flex size-9 items-center justify-center rounded-md text-icon-muted hover:bg-bg-hover hover:text-icon-default";
  if (!viewer?.username) {
    return (
      <Link href="/entrar" className={buttonClasses({ size: "sm" })}>
        {t("signIn")}
      </Link>
    );
  }
  return (
    <>
      <Link href="/notificacoes" className={`${icon} hidden md:flex`} aria-label={t("notifications")}>
        <Bell className="size-5" aria-hidden="true" />
      </Link>
      <span className="hidden md:inline-flex">
        <Link href="/projetos/novo" className={buttonClasses({ size: "sm" })}>
          <Plus className="size-4" aria-hidden="true" />
          {t("publish")}
        </Link>
      </span>
      <Link href="/projetos/novo" className={`${icon} md:hidden`} aria-label={t("publish")}>
        <Plus className="size-5" aria-hidden="true" />
      </Link>
      <span className="hidden md:inline-flex">
        <UserMenu name={viewer.displayName || viewer.username} username={viewer.username} avatarUrl={viewer.avatarUrl} />
      </span>
    </>
  );
}

async function ViewerTabBar() {
  const viewer = await getViewer();
  return <TabBar profileHref={viewer?.username ? `/@${viewer.username}` : "/entrar"} />;
}
