"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { AvatarFrame } from "@/components/profile/avatar-frame";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { CATALOG_KINDS, messageKey, type CatalogKind, type CatalogRow } from "@/lib/moderation/catalog";
import { setCatalogItem } from "@/lib/moderation/profile-actions";
import type { BadgeKey } from "@/lib/social/badges";
import { ACCENT_COLORS, type Accent } from "@/lib/social/profile-style";

export const INPUT =
  "h-9 rounded-md border border-border-strong bg-bg-base px-3 text-sm text-text-primary placeholder:text-text-subtle focus:border-border-focus focus:outline-none";

/** Prévia pequena de qualquer item do catálogo. */
export function ItemPreview({ kind, itemKey }: { kind: CatalogKind; itemKey: string }) {
  if (kind === "banner") return <ProfileBanner preset={itemKey} className="aspect-[3/1] w-24 shrink-0 rounded-md border border-border-default" />;
  if (kind === "accent")
    return <span aria-hidden="true" className="size-8 shrink-0 rounded-full" style={{ background: ACCENT_COLORS[itemKey as Accent] ?? "#94A3B8" }} />;
  if (kind === "frame")
    return (
      <AvatarFrame frame={itemKey}>
        <Avatar name="Dev" size="sm" className="border-2 border-bg-surface" />
      </AvatarFrame>
    );
  return <BadgeIcon badge={itemKey as BadgeKey} size="md" />;
}

/** Aba Catálogo do /admin: liga, desliga e renomeia banners, cores, bordas e insígnias. */
export function CatalogPanel({ items }: { items: CatalogRow[] }) {
  const t = useTranslations("AdminProfiles");
  return (
    <section className="flex flex-col gap-6">
      <p className="text-sm text-text-muted">{t("catalogIntro")}</p>
      {CATALOG_KINDS.map((kind) => {
        const list = items.filter((i) => i.kind === kind);
        return (
          <div key={kind} className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {t(`kinds.${kind}`)} <span className="text-sm font-normal text-text-muted tabular-nums">{list.filter((i) => i.active).length}/{list.length}</span>
            </h2>
            <ul className="flex flex-col divide-y divide-border-default rounded-xl border border-border-default bg-bg-surface">
              {list.map((item) => (
                <CatalogItemRow key={`${item.kind}:${item.key}`} item={item} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function CatalogItemRow({ item }: { item: CatalogRow }) {
  const t = useTranslations("AdminProfiles");
  const all = useTranslations() as unknown as (key: string) => string;
  const router = useRouter();
  const [label, setLabel] = useState(item.label ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [group, key] = messageKey(item.kind, item.key);
  const name = all(`${group}.${key}`);

  const save = (active: boolean, newLabel: string) =>
    start(async () => {
      const res = await setCatalogItem(item.kind, item.key, active, newLabel);
      if ("error" in res) return setError(t(`errors.${res.error}`));
      setError(null);
      router.refresh();
    });

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${item.active ? "" : "bg-bg-base/60"}`}>
      <ItemPreview kind={item.kind} itemKey={item.key} />
      <div className="flex min-w-32 flex-1 flex-col">
        <span className={`text-sm font-semibold ${item.active ? "text-text-primary" : "text-text-muted line-through"}`}>{name}</span>
        <span className="font-mono text-xs text-text-subtle">
          {item.key} · {item.active ? t("on") : t("offLabel")}
        </span>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save(item.active, label);
        }}
      >
        <label className="sr-only" htmlFor={`nome-${item.kind}-${item.key}`}>
          {t("rename")} ({name})
        </label>
        <input
          id={`nome-${item.kind}-${item.key}`}
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("renamePlaceholder")}
          className={`${INPUT} w-36`}
        />
        <button type="submit" disabled={pending || label === (item.label ?? "")} className={buttonClasses({ variant: "ghost", size: "sm" })}>
          {t("renameSave")}
        </button>
      </form>
      <button
        type="button"
        disabled={pending}
        onClick={() => save(!item.active, item.label ?? "")}
        aria-label={`${item.active ? t("turnOff") : t("turnOn")}: ${name}`}
        className={buttonClasses({ variant: item.active ? "secondary" : "primary", size: "sm" })}
      >
        {item.active ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        <span className="ml-1.5">{item.active ? t("turnOff") : t("turnOn")}</span>
      </button>
      {error ? (
        <p role="alert" className="w-full text-xs text-status-danger-text">
          {error}
        </p>
      ) : null}
    </li>
  );
}
