import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProfileManager } from "@/components/moderation/profile-manager";
import { Avatar } from "@/components/ui/avatar";
import { getViewer } from "@/lib/auth/viewer";
import { getCatalogRows } from "@/lib/moderation/catalog-state";
import { getAdminProfile, type AdminHistoryEntry } from "@/lib/moderation/profile-queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: `${t("metaTitle")} · Devsync`, robots: { index: false, follow: false } };
}

export default function AdminProfilePage({ params }: PageProps<"/admin/perfis/[id]">) {
  return (
    <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
        <Manage params={params} />
      </Suspense>
    </main>
  );
}

async function Manage({ params }: Pick<PageProps<"/admin/perfis/[id]">, "params">) {
  const viewer = await getViewer();
  // Igual ao /admin: para quem não é admin a página não existe (o banco também recusa).
  if (!viewer?.isAdmin) notFound();
  const { id } = await params;
  const [profile, rows] = await Promise.all([getAdminProfile(id), getCatalogRows()]);
  if (!profile) notFound();
  const t = await getTranslations("AdminProfiles");
  const off = (kind: string) => rows.filter((r) => r.kind === kind && !r.active).map((r) => r.key);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin?aba=perfis" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <header className="flex items-center gap-4">
        <Avatar name={profile.displayName ?? profile.username ?? "?"} src={profile.avatarUrl} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-display text-2xl font-bold text-text-primary">{profile.displayName ?? profile.username ?? "—"}</h1>
          <p className="text-sm text-text-muted">
            {profile.username ? `@${profile.username}` : t("noUsername")}
            {profile.isAdmin ? ` · ${t("admin")}` : null}
            {profile.suspended ? ` · ${t("suspended")}` : null}
          </p>
          {profile.username ? (
            <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1 text-sm text-brand-accent hover:underline">
              {t("viewProfile")}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </header>
      <ProfileManager profile={profile} disabledBadges={off("badge")} disabledFrames={off("frame")} />
      <History entries={profile.history} />
    </div>
  );
}

async function History({ entries }: { entries: AdminHistoryEntry[] }) {
  // Chaves montadas a partir do registro: tipagem solta, conferindo com has().
  type Loose = { (key: string, values?: Record<string, string>): string; has(key: string): boolean };
  const t = (await getTranslations("AdminProfiles")) as unknown as Loose;
  const all = (await getTranslations()) as unknown as Loose;
  const format = await getFormatter();
  const describe = (e: AdminHistoryEntry) => {
    const d = e.details as { badge?: string; kind?: string; key?: string };
    if (e.action === "award_badge" || e.action === "revoke_badge") {
      return t(`actions.${e.action}`, { item: d.badge && all.has(`Badges.${d.badge}_name`) ? all(`Badges.${d.badge}_name`) : (d.badge ?? "?") });
    }
    if (e.action === "grant_item" || e.action === "revoke_item") {
      const item = d.kind && d.key && all.has(`ProfileStyle.${d.kind}_${d.key}`) ? all(`ProfileStyle.${d.kind}_${d.key}`) : (d.key ?? "?");
      return t(`actions.${e.action}`, { item: `${d.kind && t.has(`kindOne.${d.kind}`) ? t(`kindOne.${d.kind}`) : ""} ${item}`.trim() });
    }
    if (e.action === "update_profile") {
      const fields = Object.keys(e.details).map((f) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f));
      return t("actions.update_profile", { fields: fields.join(", ") });
    }
    return t.has(`actions.${e.action}`) ? t(`actions.${e.action}`) : e.action;
  };
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold text-text-primary">{t("historyTitle")}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-text-muted">{t("historyEmpty")}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border-default rounded-xl border border-border-default bg-bg-surface">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2.5 text-sm">
              <span className="text-text-primary">{describe(e)}</span>
              <span className="text-xs text-text-muted">
                {e.adminUsername ? t("historyBy", { username: e.adminUsername }) : null} · {format.relativeTime(new Date(e.createdAt))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
