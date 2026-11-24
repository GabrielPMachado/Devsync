import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DomainsPanel } from "@/components/moderation/domains-panel";
import { QueueCard } from "@/components/moderation/queue-card";
import { getViewer } from "@/lib/auth/viewer";
import { getBlockedDomains, getQueue } from "@/lib/moderation/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  // Página interna: fora dos buscadores.
  return { title: `${t("metaTitle")} · Devsync`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/admin">;
const TABS = { abertas: "open", resolvidas: "resolved", dominios: "domains" } as const;
type Tab = (typeof TABS)[keyof typeof TABS];

export default function AdminPage({ searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
        <Admin searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Admin({ searchParams }: Pick<Props, "searchParams">) {
  const viewer = await getViewer();
  // Para quem não é admin (logado ou não) a página não existe; o banco também recusa as RPCs.
  if (!viewer?.isAdmin) notFound();

  const query = await searchParams;
  const raw = typeof query.aba === "string" ? query.aba : "abertas";
  const tab: Tab = TABS[raw as keyof typeof TABS] ?? "open";
  const t = await getTranslations("Admin");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-text-primary">
          <ShieldCheck className="size-6 text-brand-accent" aria-hidden="true" />
          {t("title")}
        </h1>
        <p className="text-sm text-text-muted">{t("subtitle")}</p>
      </header>
      <nav aria-label={t("title")} className="flex gap-1 border-b border-border-default">
        {(Object.entries(TABS) as [string, Tab][]).map(([slug, value]) => (
          <Link
            key={slug}
            href={slug === "abertas" ? "/admin" : `/admin?aba=${slug}`}
            aria-current={tab === value ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === value ? "border-brand-accent text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
          >
            {t(`tabs.${value}`)}
          </Link>
        ))}
      </nav>
      {tab === "domains" ? <DomainsPanel domains={await getBlockedDomains()} /> : <Queue mode={tab} empty={tab === "open" ? t("empty") : t("emptyResolved")} />}
    </div>
  );
}

async function Queue({ mode, empty }: { mode: "open" | "resolved"; empty: string }) {
  const items = await getQueue(mode);
  if (items.length === 0) return <p className="rounded-xl border border-border-default bg-bg-surface px-6 py-10 text-center text-sm text-text-muted">{empty}</p>;
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <QueueCard key={`${item.targetType}:${item.targetId}:${item.resolution ?? "open"}`} item={item} mode={mode} />
      ))}
    </div>
  );
}
