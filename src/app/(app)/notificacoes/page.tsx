import { CheckCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { markAllRead } from "./actions";
import { MarkSeen } from "@/components/social/mark-seen";
import { NotificationItem } from "@/components/social/notification-item";
import { buttonClasses } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";
import { loadNotifications, unreadCount, type NotificationView } from "@/lib/social/notification-queries";
import { followingSet } from "@/lib/social/queries";

type Search = PageProps<"/notificacoes">["searchParams"];
const TABS = ["todas", "respostas", "seguidores"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notifications");
  return { title: `${t("title")} · Devsync` };
}

export default async function Page({ searchParams }: { searchParams: Search }) {
  const t = await getTranslations("Notifications");
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-text-primary md:text-3xl">{t("title")}</h1>
        <form action={markAllRead} className="ml-auto">
          <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            <CheckCheck className="size-4" aria-hidden="true" />
            {t("markAll")}
          </button>
        </form>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-bg-surface" />}>
        <List searchParams={searchParams} />
      </Suspense>
      <p className="text-center text-xs text-text-subtle">{t("realtime")}</p>
    </main>
  );
}

async function List({ searchParams }: { searchParams: Search }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar?next=%2Fnotificacoes");
  const sp = await searchParams;
  const raw = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const tab = TABS.find((x) => x === raw) ?? "todas";
  const [items, total] = await Promise.all([loadNotifications(viewer.id, tab), unreadCount(viewer.id)]);
  const actorIds = items.flatMap((n) => (n.type === "follow" && n.actors[0]?.id ? [n.actors[0].id] : []));
  const follows = await followingSet(viewer.id, actorIds);
  const t = await getTranslations("Notifications");
  const now = new Date();
  const unreadIds = items.filter((n) => n.unread).flatMap((n) => n.ids);
  const startOfDay = new Date(now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) + "T00:00:00-03:00");
  const today = items.filter((n) => new Date(n.createdAt) >= startOfDay);
  const earlier = items.filter((n) => new Date(n.createdAt) < startOfDay);

  const section = (title: string, list: NotificationView[]) =>
    list.length > 0 ? (
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">{title}</h2>
        <ul className="flex flex-col gap-2">
          {list.map((n) => (
            <NotificationItem key={n.key} n={n} now={now} viewerId={viewer.id} followsActor={!!n.actors[0]?.id && follows.has(n.actors[0].id)} />
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <>
      <nav aria-label={t("tabs")} className="border-b border-border-default">
        <ul className="flex gap-6">
          {TABS.map((x) => (
            <li key={x}>
              <Link
                href={x === "todas" ? "/notificacoes" : `/notificacoes?aba=${x}`}
                aria-current={x === tab ? "page" : undefined}
                className={`-mb-px inline-flex border-b-2 px-0.5 py-2.5 text-sm ${x === tab ? "border-brand-accent font-semibold text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
              >
                {t(`tab_${x}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-default px-4 py-12 text-center text-sm text-text-muted">{t("empty")}</p>
      ) : (
        <>
          {section(t("today"), today)}
          {section(t("earlier"), earlier)}
        </>
      )}
      <MarkSeen ids={unreadIds} remaining={Math.max(total - unreadIds.length, 0)} />
    </>
  );
}
