"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { ACCENT_COLORS, ACCENTS, BANNER_PRESETS, isAccent } from "@/lib/social/profile-style";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { PickerHeader } from "./picker-header";

const FOCUS = "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-focus";

/** Selo de "escolhido" no canto da opção. */
function Picked() {
  return (
    <span aria-hidden="true" className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-brand-accent text-bg-base shadow-md">
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

/** Banners prontos (o "Padrão" é o gradiente da marca). */
export function BannerPicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const options = [{ key: "", label: t("bannerDefault") }, ...BANNER_PRESETS.map((p) => ({ key: p, label: style(`banner_${p}`) }))];
  const current = options.find((o) => o.key === value) ?? options[0];
  return (
    <fieldset className="flex flex-col" disabled={disabled}>
      <legend className="sr-only">{t("banner")}</legend>
      <PickerHeader title={t("banner")} selected={current.label} count={t("countOptions", { count: BANNER_PRESETS.length })} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
        {options.map((o) => {
          const on = value === o.key;
          return (
            <label key={o.key || "padrao"} className={`group relative flex cursor-pointer flex-col gap-1.5 ${FOCUS} rounded-lg`}>
              <input type="radio" name="bannerPresetChoice" className="sr-only" checked={on} onChange={() => onChange(o.key)} aria-label={o.label} />
              <ProfileBanner
                preset={o.key || null}
                className={`aspect-[3/1] w-full rounded-lg border transition ${on ? "border-brand-accent ring-2 ring-brand-accent/60" : "border-border-default group-hover:border-border-strong"}`}
              />
              {on ? <Picked /> : null}
              <span className={`px-0.5 text-xs ${on ? "font-medium text-text-primary" : "text-text-muted"}`}>{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Cor de destaque do perfil. */
export function AccentPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const current = isAccent(value) ? value : "azul";
  return (
    <fieldset className="flex flex-col">
      <legend className="sr-only">{t("accent")}</legend>
      <PickerHeader title={t("accent")} selected={style(`accent_${current}`)} count={t("countOptions", { count: ACCENTS.length })} />
      <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-12">
        {ACCENTS.map((a) => {
          const on = current === a;
          return (
            <label key={a} title={style(`accent_${a}`)} className={`relative flex cursor-pointer justify-center rounded-full ${FOCUS}`}>
              <input type="radio" name="accentChoice" className="sr-only" checked={on} onChange={() => onChange(a)} aria-label={style(`accent_${a}`)} />
              <span
                aria-hidden="true"
                className={`flex size-10 items-center justify-center rounded-full transition ${on ? "ring-2 ring-text-primary ring-offset-2 ring-offset-bg-surface" : "hover:scale-105"}`}
                style={{ background: `linear-gradient(145deg, ${ACCENT_COLORS[a]}, color-mix(in srgb, ${ACCENT_COLORS[a]} 65%, #000))` }}
              >
                {on ? <Check className="size-4 text-white drop-shadow" strokeWidth={3} /> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
