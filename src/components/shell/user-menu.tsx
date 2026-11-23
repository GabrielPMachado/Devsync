"use client";

import { LogOut, User } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";

type Props = { name: string; username: string; avatarUrl: string | null };

/** Avatar com o menu da conta (Meu perfil, Sair). Fecha ao clicar fora ou com Esc. */
export function UserMenu({ name, username, avatarUrl }: Props) {
  const t = useTranslations("Nav");
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function close(e: MouseEvent | KeyboardEvent) {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    }
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary role="button" aria-haspopup="menu" aria-label={t("userMenu")} className="flex cursor-pointer list-none rounded-full [&::-webkit-details-marker]:hidden">
        <Avatar name={name} src={avatarUrl} size="sm" />
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 rounded-lg border border-border-default bg-bg-elevated p-1.5 shadow-xl shadow-black/40">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
          <p className="truncate font-mono text-xs text-text-muted">@{username}</p>
        </div>
        <hr className="my-1 border-border-default" />
        <Link href={`/@${username}`} onClick={() => ref.current?.removeAttribute("open")} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary">
          <User className="size-4" aria-hidden="true" />
          {t("myProfile")}
        </Link>
        <form action="/auth/sair" method="post">
          <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary">
            <LogOut className="size-4" aria-hidden="true" />
            {t("signOut")}
          </button>
        </form>
      </div>
    </details>
  );
}
