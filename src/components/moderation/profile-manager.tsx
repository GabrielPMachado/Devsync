"use client";

import { Check, ImageOff, RotateCcw, Unlock, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { buttonClasses } from "@/components/ui/button";
import { setBadge, setItemGrant, updateProfileAsAdmin, type ProfileAdminResult, type ProfileChanges } from "@/lib/moderation/profile-actions";
import type { AdminProfile } from "@/lib/moderation/profile-queries";
import { BADGE_KEYS, type BadgeKey } from "@/lib/social/badges";
import { FRAMES, STATUSES } from "@/lib/social/profile-style";
import { INPUT, ItemPreview } from "./catalog-panel";

type Props = { profile: AdminProfile; disabledBadges: string[]; disabledFrames: string[] };

/** Página do perfil no /admin: dados, insígnias e bordas liberadas à mão. */
export function ProfileManager({ profile, disabledBadges, disabledFrames }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <DataSection profile={profile} />
      <BadgesSection profile={profile} disabled={disabledBadges} />
      <FramesSection profile={profile} disabled={disabledFrames} />
    </div>
  );
}

function useRun() {
  const t = useTranslations("AdminProfiles");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const run = (call: () => Promise<ProfileAdminResult>, after?: () => void) =>
    start(async () => {
      const res = await call();
      if ("error" in res) {
        setDone(false);
        return setError(t(`errors.${res.error}`));
      }
      setError(null);
      setDone(true);
      after?.();
      router.refresh();
    });
  return { run, error, done, pending };
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-surface p-4 md:p-5">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
        {hint ? <p className="text-sm text-text-muted">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Alert({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-status-danger-text">
      {error}
    </p>
  ) : null;
}

type TextField = "username" | "displayName" | "headline" | "location" | "bio";
const LIMITS: Record<TextField, number> = { username: 30, displayName: 80, headline: 80, location: 60, bio: 500 };

function DataSection({ profile }: { profile: AdminProfile }) {
  const t = useTranslations("AdminProfiles");
  const style = useTranslations("ProfileStyle");
  const id = useId();
  const { run, error, done, pending } = useRun();
  const initial = {
    username: profile.username ?? "",
    displayName: profile.displayName ?? "",
    headline: profile.headline ?? "",
    location: profile.location ?? "",
    bio: profile.bio ?? "",
    status: profile.status ?? "",
  };
  const [v, setV] = useState(initial);
  const changed = (Object.keys(initial) as (keyof typeof initial)[]).filter((k) => v[k] !== initial[k]);

  const field = (name: TextField, multiline = false) => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-text-primary" htmlFor={`${id}-${name}`}>
      {t(name)}
      {multiline ? (
        <textarea id={`${id}-${name}`} value={v[name]} maxLength={LIMITS[name]} rows={3} onChange={(e) => setV({ ...v, [name]: e.target.value })} className={`${INPUT} h-auto py-2`} />
      ) : (
        <input id={`${id}-${name}`} value={v[name]} maxLength={LIMITS[name]} onChange={(e) => setV({ ...v, [name]: e.target.value })} className={INPUT} />
      )}
    </label>
  );

  return (
    <Card title={t("dataTitle")} hint={t("dataHint")}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const changes: ProfileChanges = Object.fromEntries(changed.map((k) => [k, v[k]]));
          run(() => updateProfileAsAdmin(profile.id, changes));
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {field("username")}
          {field("displayName")}
          {field("headline")}
          {field("location")}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-text-primary" htmlFor={`${id}-status`}>
          {t("status")}
          <select id={`${id}-status`} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })} className={INPUT}>
            <option value="">{t("statusNone")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {style(`status_${s}`)}
              </option>
            ))}
          </select>
        </label>
        {field("bio", true)}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || changed.length === 0} className={buttonClasses({ size: "sm" })}>
            {t("save")}
          </button>
          {done && !error ? <span className="text-sm text-text-muted">{t("saved")}</span> : null}
        </div>
      </form>
      <div className="flex flex-wrap gap-2 border-t border-border-default pt-4">
        <button type="button" disabled={pending || !profile.avatarUrl} onClick={() => run(() => updateProfileAsAdmin(profile.id, { removeAvatar: true }))} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <UserX className="mr-1.5 size-4" aria-hidden="true" />
          {t("removeAvatar")}
        </button>
        <button type="button" disabled={pending || !profile.bannerUrl} onClick={() => run(() => updateProfileAsAdmin(profile.id, { removeBanner: true }))} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <ImageOff className="mr-1.5 size-4" aria-hidden="true" />
          {t("removeBanner")}
        </button>
        <button
          type="button"
          title={t("resetAppearanceHint")}
          disabled={pending || !(profile.bannerPreset || profile.accent || profile.avatarFrame)}
          onClick={() => run(() => updateProfileAsAdmin(profile.id, { resetAppearance: true }))}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          <RotateCcw className="mr-1.5 size-4" aria-hidden="true" />
          {t("resetAppearance")}
        </button>
      </div>
      <Alert error={error} />
    </Card>
  );
}

function BadgesSection({ profile, disabled }: { profile: AdminProfile; disabled: string[] }) {
  const t = useTranslations("AdminProfiles");
  const b = useTranslations("Badges");
  const id = useId();
  const { run, error, pending } = useRun();
  const [notify, setNotify] = useState(true);
  const earned = new Set(profile.badges.map((x) => x.badge));

  return (
    <Card title={t("badgesTitle")} hint={t("badgesHint")}>
      <label className="flex items-center gap-2 text-sm text-text-secondary" htmlFor={`${id}-notify`}>
        <input id={`${id}-notify`} type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-brand-accent" />
        {t("notify")}
      </label>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BADGE_KEYS.map((key: BadgeKey) => {
          const has = earned.has(key);
          const name = b(`${key}_name`);
          return (
            <li key={key} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${has ? "border-brand-accent/50" : "border-border-default"}`}>
              <BadgeIcon badge={key} size="md" muted={!has} />
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-text-primary">{name}</span>
                <span className="text-xs text-text-muted">
                  {has ? t("has") : null}
                  {has && disabled.includes(key) ? " · " : null}
                  {disabled.includes(key) ? t("off") : null}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                aria-label={`${has ? t("take") : t("give")}: ${name}`}
                onClick={() => run(() => setBadge(profile.id, key, !has, notify))}
                className={buttonClasses({ variant: has ? "ghost" : "secondary", size: "sm" })}
              >
                {has ? t("take") : t("give")}
              </button>
            </li>
          );
        })}
      </ul>
      <Alert error={error} />
    </Card>
  );
}

function FramesSection({ profile, disabled }: { profile: AdminProfile; disabled: string[] }) {
  const t = useTranslations("AdminProfiles");
  const style = useTranslations("ProfileStyle");
  const b = useTranslations("Badges");
  const { run, error, pending } = useRun();
  const earned = new Set(profile.badges.map((x) => x.badge));
  const granted = new Set(profile.grants.filter((g) => g.kind === "frame").map((g) => g.key));

  return (
    <Card title={t("framesTitle")} hint={t("framesHint")}>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FRAMES.map((f) => {
          const isGranted = granted.has(f.key);
          const name = style(`frame_${f.key}`);
          const source = isGranted
            ? t("granted")
            : f.requiresBadge
              ? `${t("byBadge")} ${b(`${f.requiresBadge}_name`)}${earned.has(f.requiresBadge) ? " ✓" : ""}`
              : t("free");
          return (
            <li key={f.key} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${isGranted ? "border-brand-accent/50" : "border-border-default"}`}>
              <ItemPreview kind="frame" itemKey={f.key} />
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-text-primary">{name}</span>
                <span className="text-xs text-text-muted">
                  {source}
                  {disabled.includes(f.key) ? ` · ${t("off")}` : null}
                  {profile.avatarFrame === f.key ? ` · ${t("inUse")}` : null}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                aria-label={`${isGranted ? t("revoke") : t("grant")}: ${name}`}
                onClick={() => run(() => setItemGrant(profile.id, "frame", f.key, !isGranted))}
                className={buttonClasses({ variant: isGranted ? "ghost" : "secondary", size: "sm" })}
              >
                {isGranted ? <Check className="mr-1.5 size-4" aria-hidden="true" /> : <Unlock className="mr-1.5 size-4" aria-hidden="true" />}
                {isGranted ? t("revoke") : t("grant")}
              </button>
            </li>
          );
        })}
      </ul>
      <Alert error={error} />
    </Card>
  );
}
