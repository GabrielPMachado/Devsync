"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onArrival, useUnread } from "./unread-store";

/** Sino do topo com o contador ao vivo e o aviso "Nova notificação". */
export function NotificationBell({ userId, initial }: { userId: string; initial: number }) {
  const t = useTranslations("Notifications");
  const unread = useUnread(userId, initial);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onArrival(() => {
      setToast(true);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(false), 5000);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <Link href="/notificacoes" className="relative flex size-9 items-center justify-center rounded-md text-icon-muted hover:bg-bg-hover hover:text-icon-default" aria-label={t("bell", { count: unread })}>
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 ? <CountBadge count={unread} /> : null}
      </Link>
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6">
        {toast ? (
          <Link href="/notificacoes" onClick={() => setToast(false)} className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border-strong bg-bg-elevated px-4 py-3 text-sm text-text-primary shadow-xl shadow-black/40">
            <Bell className="size-4 text-brand-accent" aria-hidden="true" />
            {t("toast")}
            <span className="font-semibold text-text-link">{t("toastOpen")}</span>
          </Link>
        ) : null}
      </div>
    </>
  );
}

export function CountBadge({ count }: { count: number }) {
  return (
    <span data-testid="unread-count" aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] leading-none font-bold text-text-on-brand">
      {count > 99 ? "99+" : count}
    </span>
  );
}
