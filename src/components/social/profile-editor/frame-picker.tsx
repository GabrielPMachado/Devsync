"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FRAMES } from "@/lib/social/profile-style";
import { FRAME_RINGS } from "./preview-style";

type Props = {
  name: string;
  avatarUrl: string | null;
  value: string;
  onChange: (frame: string) => void;
  /** Insígnias da pessoa. Sem a lista, todas as bordas ficam liberadas. */
  unlockedBadges?: string[];
};

/** Escolha da borda da foto. Bordas por conquista ficam com cadeado e a dica de como liberar. */
export function FramePicker({ name, avatarUrl, value, onChange, unlockedBadges }: Props) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const baseId = useId();
  const locked = FRAMES.filter((f) => f.requiresBadge && unlockedBadges && !unlockedBadges.includes(f.requiresBadge));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-semibold text-text-secondary">{t("frame")}</legend>
      <div role="radiogroup" aria-label={t("frame")} className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        <Option checked={value === ""} label={t("frameNone")} short={t("frameNone")} onSelect={() => onChange("")}>
          <Avatar name={name} src={avatarUrl} size="md" />
        </Option>
        {FRAMES.map((f) => {
          const isLocked = locked.includes(f);
          const label = t("frameOption", { name: style(`frame_${f.key}`).toLowerCase() });
          return (
            <Option
              key={f.key}
              checked={value === f.key}
              label={label}
              short={style(`frame_${f.key}`)}
              describedBy={isLocked ? `${baseId}-${f.key}` : undefined}
              disabled={isLocked}
              onSelect={() => onChange(f.key)}
            >
              <span className={`relative inline-flex rounded-full ${FRAME_RINGS[f.key] ?? ""} ${isLocked ? "opacity-40" : ""}`}>
                <Avatar name={name} src={avatarUrl} size="md" />
              </span>
              {isLocked ? <Lock className="absolute top-1 right-1 size-3.5 text-text-muted" aria-hidden="true" /> : null}
            </Option>
          );
        })}
      </div>
      {locked.length ? (
        <ul className="flex flex-col gap-1 text-xs text-text-muted">
          {locked.map((f) => (
            <li key={f.key} id={`${baseId}-${f.key}`} className="flex items-center gap-1.5">
              <Lock className="size-3" aria-hidden="true" />
              <span className="font-semibold text-text-secondary">{style(`frame_${f.key}`)}:</span>
              {t("frameLocked", { badge: t(`badge_${f.requiresBadge!}`) })}
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}

function Option({
  checked,
  label,
  short,
  describedBy,
  disabled,
  onSelect,
  children,
}: {
  checked: boolean;
  label: string;
  short: string;
  describedBy?: string;
  disabled?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      title={label}
      className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors ${
        checked ? "border-brand-accent bg-brand-accent-soft" : "border-border-default hover:border-border-strong"
      } ${disabled ? "cursor-not-allowed" : "cursor-pointer"} has-focus-visible:outline-2 has-focus-visible:outline-border-focus`}
    >
      <input type="radio" className="sr-only" checked={checked} disabled={disabled} onChange={onSelect} aria-label={label} aria-describedby={describedBy} />
      {children}
      <span className="text-[11px] leading-tight text-text-muted">{short}</span>
    </label>
  );
}
