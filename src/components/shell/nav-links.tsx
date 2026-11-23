"use client";

import { Bell, BookOpen, FolderGit2, House, User } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MAIN = [
  { href: "/", key: "home", Icon: House },
  { href: "/projetos", key: "projects", Icon: FolderGit2 },
  { href: "/estudos", key: "studies", Icon: BookOpen },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Links da barra de cima no desktop: Início, Projetos, Estudos. */
export function NavLinks() {
  return <NavLinksView pathname={usePathname()} />;
}

/** Sem hook de URL: serve de fallback do <Suspense> enquanto a rota não é conhecida. */
export function NavLinksView({ pathname }: { pathname: string }) {
  const t = useTranslations("Nav");
  return (
    <ul className="flex items-center gap-1">
      {MAIN.map(({ href, key, Icon }) => {
        const on = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={on ? "page" : undefined}
              className={`flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                on ? "bg-bg-hover text-text-primary" : "text-text-muted hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <Icon className={`size-4 ${on ? "text-brand-accent" : ""}`} aria-hidden="true" />
              {t(key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Abas de baixo no celular (5 abas, como no Figma). */
export function TabBar({ profileHref }: { profileHref: string }) {
  return <TabBarView profileHref={profileHref} pathname={usePathname()} />;
}

export function TabBarView({ profileHref, pathname }: { profileHref: string; pathname: string }) {
  const t = useTranslations("Nav");
  const tabs = [
    ...MAIN,
    { href: "/notificacoes", key: "notifications", Icon: Bell },
    { href: profileHref, key: "profile", Icon: User },
  ] as const;

  return (
    <nav aria-label={t("tabs")} className="fixed inset-x-0 bottom-0 z-30 border-t border-border-default bg-bg-surface pb-[max(env(safe-area-inset-bottom),12px)] md:hidden">
      <ul className="flex">
        {tabs.map(({ href, key, Icon }) => {
          const on = isActive(pathname, href);
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-2 pb-1 text-[11px] font-medium ${on ? "text-text-primary" : "text-text-muted"}`}
              >
                <Icon className={`size-5.5 ${on ? "text-brand-accent" : ""}`} aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
