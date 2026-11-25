import { Search } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { findProfiles } from "@/lib/moderation/profile-queries";
import { INPUT } from "./catalog-panel";

/** Aba Perfis do /admin: busca por @ ou nome e leva à página de gerenciar o perfil. */
export async function ProfileSearch({ query }: { query: string }) {
  const t = await getTranslations("AdminProfiles");
  const tAdmin = await getTranslations("Admin");
  const format = await getFormatter();
  const people = await findProfiles(query);
  return (
    <section className="flex flex-col gap-4">
      <form action="/admin" className="flex gap-2" role="search">
        <input type="hidden" name="aba" value="perfis" />
        <label htmlFor="busca-perfil" className="sr-only">
          {t("searchLabel")}
        </label>
        <input id="busca-perfil" name="q" defaultValue={query} placeholder={t("searchPlaceholder")} maxLength={60} className={`${INPUT} h-10 flex-1`} />
        <button type="submit" className={buttonClasses()}>
          <Search className="mr-1.5 size-4" aria-hidden="true" />
          {t("search")}
        </button>
      </form>
      <h2 className="text-xs font-semibold tracking-wider text-text-subtle uppercase">{query ? t("results") : t("recent")}</h2>
      {people.length === 0 ? (
        <p className="rounded-xl border border-border-default bg-bg-surface px-6 py-10 text-center text-sm text-text-muted">{t("none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-default rounded-xl border border-border-default bg-bg-surface">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.displayName ?? p.username ?? "?"} src={p.avatarUrl} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-text-primary">{p.displayName ?? p.username ?? "—"}</span>
                <span className="truncate text-xs text-text-muted">
                  {p.username ? `@${p.username}` : t("noUsername")} · {t("joined", { when: format.relativeTime(new Date(p.createdAt)) })}
                  {p.isAdmin ? ` · ${t("admin")}` : null}
                  {p.suspended ? ` · ${tAdmin("authorSuspended")}` : null}
                </span>
              </span>
              <Link href={`/admin/perfis/${p.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                {t("manage")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
