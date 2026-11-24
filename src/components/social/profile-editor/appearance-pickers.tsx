"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { ACCENT_COLORS, ACCENTS, BANNER_PRESETS } from "@/lib/social/profile-style";
import { BANNER_BACKGROUNDS } from "./preview-style";

const RING = "has-checked:border-brand-accent has-checked:ring-2 has-checked:ring-brand-accent has-focus-visible:outline-2 has-focus-visible:outline-border-focus";

/** Banners prontos (o "Padrão" é o gradiente da marca). */
export function BannerPicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const options = [{ key: "", label: t("bannerDefault"), bg: BANNER_BACKGROUNDS.padrao }, ...BANNER_PRESETS.map((p) => ({ key: p, label: style(`banner_${p}`), bg: BANNER_BACKGROUNDS[p] }))];
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-3 text-sm font-semibold text-text-secondary">{t("banner")}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {options.map((o) => (
          <label key={o.key || "padrao"} className={`flex cursor-pointer flex-col gap-1.5 rounded-lg border border-border-default p-1.5 ${RING}`}>
            <input type="radio" name="bannerPresetChoice" className="sr-only" checked={value === o.key} onChange={() => onChange(o.key)} aria-label={o.label} />
            <span aria-hidden="true" className="h-12 rounded-md border border-border-default" style={{ background: o.bg }} />
            <span className="px-1 text-xs text-text-secondary">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Cor de destaque do perfil. */
export function AccentPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const current = value || "azul";
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-semibold text-text-secondary">{t("accent")}</legend>
      <div className="flex flex-wrap gap-3">
        {ACCENTS.map((a) => (
          <label key={a} title={style(`accent_${a}`)} className="relative cursor-pointer rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-focus">
            <input type="radio" name="accentChoice" className="sr-only" checked={current === a} onChange={() => onChange(a)} aria-label={style(`accent_${a}`)} />
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full border-2 border-bg-base" style={{ background: ACCENT_COLORS[a] }}>
              {current === a ? <Check className="size-4 text-white drop-shadow" /> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
