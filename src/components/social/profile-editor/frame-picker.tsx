"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { FRAMES } from "@/lib/social/profile-style";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { AvatarFrame } from "@/components/profile/avatar-frame";
import { Hint } from "@/components/ui/hint";

type Props = {
  name: string;
  avatarUrl: string | null;
  value: string;
  onChange: (frame: string) => void;
  /** Insígnias da pessoa. Sem a lista, as bordas por conquista ficam bloqueadas. */
  unlockedBadges?: string[];
};

/** Escolha da borda da foto. Bordas por conquista ficam com cadeado; como liberar aparece numa dica ao passar o mouse ou tocar. */
export function FramePicker({ name, avatarUrl, value, onChange, unlockedBadges }: Props) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const badges = useTranslations("Badges");
  const locked = FRAMES.filter((f) => f.requiresBadge && !(unlockedBadges ?? []).includes(f.requiresBadge));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-semibold text-text-secondary">{t("frame")}</legend>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        <Option checked={value === ""} label={t("frameNone")} short={t("frameNone")} onSelect={() => onChange("")}>
          <Avatar name={name} src={avatarUrl} size="md" />
        </Option>
        {FRAMES.map((f) => {
          const isLocked = locked.includes(f);
          const label = t("frameOption", { name: style(`frame_${f.key}`).toLowerCase() });
          const art = (
            <AvatarFrame frame={f.key}>
              <Avatar name={name} src={avatarUrl} size="md" className="border-2 border-bg-surface" />
            </AvatarFrame>
          );
          if (isLocked) {
            const badge = f.requiresBadge!;
            return (
              <Hint
                key={f.key}
                className="flex"
                content={
                  <span className="flex items-start gap-2.5">
                    <BadgeIcon badge={badge} size="md" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-text-primary">{t("frameLocked", { badge: t(`badge_${badge}`) })}</span>
                      <span>{badges(`${badge}_how`)}.</span>
                    </span>
                  </span>
                }
              >
                {(hint) => (
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-label={label}
                    {...hint}
                    className="relative flex w-full cursor-help flex-col items-center gap-1.5 rounded-lg border border-dashed border-border-default p-2 text-center transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-border-focus"
                  >
                    <span className="inline-flex opacity-35 grayscale-[60%]">{art}</span>
                    <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-bg-base/90 text-text-muted ring-1 ring-border-default" aria-hidden="true">
                      <Lock className="size-3" />
                    </span>
                    <span className="text-[11px] leading-tight text-text-subtle">{style(`frame_${f.key}`)}</span>
                  </button>
                )}
              </Hint>
            );
          }
          return (
            <Option key={f.key} checked={value === f.key} label={label} short={style(`frame_${f.key}`)} onSelect={() => onChange(f.key)}>
              {art}
            </Option>
          );
        })}
      </div>
    </fieldset>
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
  children: React.ReactNode;
}) {
  return (
    <label
      title={label}
      className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors ${
        checked ? "border-brand-accent bg-brand-accent-soft" : "border-border-default hover:border-border-strong"
      } cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-border-focus`}
    >
      <input type="radio" name="avatarFrameChoice" className="sr-only" checked={checked} onChange={onSelect} aria-label={label} />
      {children}
      <span className="text-[11px] leading-tight text-text-muted">{short}</span>
    </label>
  );
}
