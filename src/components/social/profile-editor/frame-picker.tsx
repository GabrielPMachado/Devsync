"use client";

import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { AvatarFrame } from "@/components/profile/avatar-frame";
import { Avatar } from "@/components/ui/avatar";
import { Hint } from "@/components/ui/hint";
import { FRAMES, type FrameDef, type FrameKey } from "@/lib/social/profile-style";
import { PickerHeader } from "./picker-header";

type Props = {
  name: string;
  avatarUrl: string | null;
  value: string;
  onChange: (frame: string) => void;
  /** Insígnias da pessoa. Sem a lista, as bordas por conquista ficam bloqueadas. */
  unlockedBadges?: string[];
};

const TILE =
  "relative flex w-full flex-col items-center gap-2 overflow-hidden rounded-xl border px-1.5 pt-3.5 pb-2 text-center transition";
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2.5";

/**
 * Escolha da borda da foto, em dois grupos: livres e por conquista.
 * As bloqueadas têm cadeado; como liberar aparece numa dica ao passar o mouse ou tocar.
 */
export function FramePicker({
  name,
  avatarUrl,
  value,
  onChange,
  unlockedBadges,
}: Props) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const badges = useTranslations("Badges");
  const has = (f: FrameDef) =>
    !f.requiresBadge || (unlockedBadges ?? []).includes(f.requiresBadge);
  const free = FRAMES.filter((f) => !f.requiresBadge);
  const earned = FRAMES.filter((f) => f.requiresBadge);
  const unlocked = FRAMES.filter(has).length;
  const current = FRAMES.find((f) => f.key === value);

  const art = (key: FrameKey) => (
    <AvatarFrame frame={key}>
      <Avatar
        name={name}
        src={avatarUrl}
        size="md"
        className="border-2 border-bg-surface"
      />
    </AvatarFrame>
  );
  const label = (key: FrameKey) =>
    t("frameOption", { name: style(`frame_${key}`).toLowerCase() });

  return (
    <fieldset className="flex flex-col">
      <legend className="sr-only">{t("frame")}</legend>
      <PickerHeader
        title={t("frame")}
        selected={current ? style(`frame_${current.key}`) : t("frameNone")}
        count={t("countUnlocked", { unlocked, total: FRAMES.length })}
      />

      <div className="flex flex-col gap-5">
        <Group title={t("framesFree")}>
          <Option
            checked={value === ""}
            label={t("frameNone")}
            short={t("frameNone")}
            onSelect={() => onChange("")}
          >
            <Avatar name={name} src={avatarUrl} size="md" />
          </Option>
          {free.map((f) => (
            <Option
              key={f.key}
              checked={value === f.key}
              label={label(f.key)}
              short={style(`frame_${f.key}`)}
              onSelect={() => onChange(f.key)}
            >
              {art(f.key)}
            </Option>
          ))}
        </Group>

        <Group
          title={t("framesEarned")}
          count={badges("groupCount", {
            earned: earned.filter(has).length,
            total: earned.length,
          })}
        >
          {earned.map((f) => {
            if (has(f)) {
              return (
                <Option
                  key={f.key}
                  checked={value === f.key}
                  label={label(f.key)}
                  short={style(`frame_${f.key}`)}
                  onSelect={() => onChange(f.key)}
                >
                  {art(f.key)}
                </Option>
              );
            }
            const badge = f.requiresBadge!;
            return (
              <Hint
                key={f.key}
                className="flex"
                content={
                  <span className="flex items-start gap-2.5">
                    <BadgeIcon badge={badge} size="md" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-text-primary">
                        {t("frameLocked", { badge: t(`badge_${badge}`) })}
                      </span>
                      <span>{badges(`${badge}_how`)}.</span>
                    </span>
                  </span>
                }
              >
                {(hint) => (
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-label={label(f.key)}
                    {...hint}
                    className={`${TILE} cursor-help border-dashed border-border-default hover:border-border-strong focus-visible:outline-2 focus-visible:outline-border-focus`}
                  >
                    <span className="inline-flex opacity-35 grayscale-[60%]">
                      {art(f.key)}
                    </span>
                    <span
                      className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-bg-base/90 text-text-muted ring-1 ring-border-default"
                      aria-hidden="true"
                    >
                      <Lock className="size-3" />
                    </span>
                    <span className="text-[11px] leading-tight text-text-subtle">
                      {style(`frame_${f.key}`)}
                    </span>
                  </button>
                )}
              </Hint>
            );
          })}
        </Group>
      </div>
    </fieldset>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
        {title}
        {count ? (
          <span className="font-medium tracking-normal normal-case tabular-nums text-text-muted">
            {count}
          </span>
        ) : null}
      </p>
      <div className={GRID}>{children}</div>
    </div>
  );
}

function Option({
  checked,
  label,
  short,
  onSelect,
  children,
}: {
  checked: boolean;
  label: string;
  short: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label
      title={label}
      className={`${TILE} cursor-pointer ${
        checked
          ? "border-brand-accent bg-brand-accent-soft"
          : "border-border-default hover:border-border-strong hover:bg-bg-elevated"
      } has-focus-visible:outline-2 has-focus-visible:outline-border-focus`}
    >
      <input
        type="radio"
        name="avatarFrameChoice"
        className="sr-only"
        checked={checked}
        onChange={onSelect}
        aria-label={label}
      />
      {children}
      {checked ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-brand-accent text-bg-base"
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      ) : null}
      <span
        className={`text-[11px] leading-tight ${checked ? "font-medium text-text-primary" : "text-text-muted"}`}
      >
        {short}
      </span>
    </label>
  );
}
