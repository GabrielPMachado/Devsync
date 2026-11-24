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
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-semibold text-text-secondary">{t("frame")}</legend>
      <div role="radiogroup" aria-label={t("frame")} className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        <Option checked={value === ""} label={t("frameNone")} onSelect={() => onChange("")}>
          <Avatar name={name} src={avatarUrl} size="md" />
        </Option>
        {FRAMES.map((f) => {
          const locked = !!(f.requiresBadge && unlockedBadges && !unlockedBadges.includes(f.requiresBadge));
          const label = t("frameOption", { name: style(`frame_${f.key}`).toLowerCase() });
          const hint = locked && f.requiresBadge ? t("frameLocked", { badge: t(`badge_${f.requiresBadge}`) }) : undefined;
          return (
            <Option key={f.key} checked={value === f.key} label={label} hint={hint} disabled={locked} onSelect={() => onChange(f.key)}>
              <span className={`relative inline-flex rounded-full ${FRAME_RINGS[f.key] ?? ""} ${locked ? "opacity-40" : ""}`}>
                <Avatar name={name} src={avatarUrl} size="md" />
              </span>
              {locked ? <Lock className="absolute top-1 right-1 size-3.5 text-text-muted" aria-hidden="true" /> : null}
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
  hint,
  disabled,
  onSelect,
  children,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  disabled?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const hintId = useId();
  return (
    <label
      title={hint ?? label}
      className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors ${
        checked ? "border-brand-accent bg-brand-accent-soft" : "border-border-default hover:border-border-strong"
      } ${disabled ? "cursor-not-allowed" : "cursor-pointer"} has-focus-visible:outline-2 has-focus-visible:outline-border-focus`}
    >
      <input type="radio" className="sr-only" checked={checked} disabled={disabled} onChange={onSelect} aria-label={label} aria-describedby={hint ? hintId : undefined} />
      {children}
      {hint ? <span id={hintId} className="text-[10px] leading-tight text-text-muted">{hint}</span> : null}
    </label>
  );
}
