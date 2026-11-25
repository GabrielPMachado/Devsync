"use client";

import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { ProfileBanner } from "@/components/profile/profile-banner";
import { lowerFirst, UnlockInfo } from "@/components/badges/unlock-info";
import { Hint, splitHint, type HintTriggerProps } from "@/components/ui/hint";
import { accentAnimation } from "@/lib/profile/accent";
import type { BadgeKey } from "@/lib/social/badges";
import {
  ACCENT_COLORS,
  ACCENT_UNLOCKS,
  ACCENTS,
  BANNER_PRESETS,
  BANNER_UNLOCKS,
  FREE_ACCENTS,
  FREE_BANNERS,
  isAccent,
  type Accent,
  type BannerPreset,
} from "@/lib/social/profile-style";
import { useCatalog } from "./catalog-context";
import { PickerHeader } from "./picker-header";

const FOCUS =
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-focus";

/** Selo de "escolhido" no canto da opção. */
function Picked() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-brand-accent text-bg-base shadow-md"
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

/** Cadeado no canto de um item bloqueado. */
function LockMark({ className = "top-1.5 right-1.5" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute flex size-5 items-center justify-center rounded-full bg-bg-base/90 text-text-muted ring-1 ring-border-default ${className}`}
    >
      <Lock className="size-3" />
    </span>
  );
}

/** Título de um grupo (Livres / Por conquista) com a contagem ao lado. */
function Group({
  title,
  count,
  className,
  children,
}: {
  title: string;
  count?: string;
  className: string;
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
      <div className={className}>{children}</div>
    </div>
  );
}

/** Dica de um item bloqueado: qual insígnia libera e como ganhar (cadeado fechado). */
function LockedHint({
  badge,
  label,
  masc,
  children,
}: {
  masc?: boolean;
  badge: BadgeKey;
  label: string;
  children: (hint: HintTriggerProps) => ReactNode;
}) {
  const t = useTranslations("Settings");
  const badges = useTranslations("Badges");
  return (
    <Hint
      className="flex"
      content={
        <UnlockInfo
          art={<BadgeIcon badge={badge} size="md" />}
          title={label}
          unlocked={false}
          status={masc ? badges("lockedShortMasc") : badges("lockedShort")}
        >
          <span>{t("frameLocked", { badge: badges(`${badge}_name`) })}</span>
          <span>{badges(`${badge}_how`)}.</span>
        </UnlockInfo>
      }
    >
      {children}
    </Hint>
  );
}

/**
 * Opção escolhível (rádio dentro do rótulo) com dica: livre = "Disponível para todos";
 * liberada por insígnia = cadeado aberto e o requisito cumprido.
 */
function HintedOption({
  badge,
  title,
  unlockedStatus,
  className,
  children,
}: {
  badge?: BadgeKey;
  title: string;
  unlockedStatus: string;
  className?: string;
  children: (parts: ReturnType<typeof splitHint>) => ReactNode;
}) {
  const t = useTranslations("Settings");
  const badges = useTranslations("Badges");
  const content = badge ? (
    <UnlockInfo
      art={<BadgeIcon badge={badge} size="md" />}
      title={title}
      unlocked
      status={unlockedStatus}
    >
      <span>
        {t("frameUnlocked", {
          badge: badges(`${badge}_name`),
          how: lowerFirst(badges(`${badge}_how`)),
        })}
        .
      </span>
    </UnlockInfo>
  ) : (
    <UnlockInfo title={title} unlocked status={t("availableToAll")} />
  );
  return (
    <Hint className={className ?? "flex"} content={content}>
      {(hint) => children(splitHint(hint))}
    </Hint>
  );
}

type PickerProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Insígnias da pessoa. Sem a lista, os itens por conquista ficam bloqueados. */
  unlockedBadges?: readonly string[];
};

/** Banners prontos: os livres (o "Padrão" é o gradiente da marca) e os animados, por conquista. */
export function BannerPicker({
  value,
  onChange,
  disabled,
  unlockedBadges = [],
}: PickerProps) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const badges = useTranslations("Badges");
  const label = (p: string) =>
    p ? style(`banner_${p as BannerPreset}`) : t("bannerDefault");
  // Desligados pela moderação somem; liberados à mão contam como conquistados.
  const { hidden, granted } = useCatalog();
  const shown = (p: BannerPreset) => !hidden.banner.includes(p);
  const free = FREE_BANNERS.filter(shown);
  const earned = BANNER_PRESETS.filter((p) => BANNER_UNLOCKS[p] && shown(p));
  const has = (p: BannerPreset) => unlockedBadges.includes(BANNER_UNLOCKS[p]!) || granted.banner.includes(p);
  const unlocked = free.length + earned.filter(has).length;
  const grid = "grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5";

  const option = (key: string) => {
    const on = value === key;
    return (
      <HintedOption
        key={key || "padrao"}
        badge={BANNER_UNLOCKS[key as BannerPreset]}
        title={label(key)}
        unlockedStatus={t("availableMasc")}
      >
        {(parts) => (
          <label
            {...parts.label}
            className={`group relative flex w-full cursor-pointer flex-col gap-1.5 ${FOCUS} rounded-lg`}
          >
            <input
              type="radio"
              name="bannerPresetChoice"
              className="sr-only top-1/2 left-1/2"
              checked={on}
              onChange={() => onChange(key)}
              aria-label={label(key)}
              {...parts.input}
            />
            <ProfileBanner
              preset={key || null}
              className={`aspect-[3/1] w-full rounded-lg border transition ${on ? "border-brand-accent ring-2 ring-brand-accent/60" : "border-border-default group-hover:border-border-strong"}`}
            />
            {on ? <Picked /> : null}
            <span
              className={`px-0.5 text-xs ${on ? "font-medium text-text-primary" : "text-text-muted"}`}
            >
              {label(key)}
            </span>
          </label>
        )}
      </HintedOption>
    );
  };

  return (
    <fieldset className="flex flex-col" disabled={disabled}>
      <legend className="sr-only">{t("banner")}</legend>
      <PickerHeader
        title={t("banner")}
        selected={label(value)}
        count={t("countUnlockedMasc", {
          unlocked,
          total: free.length + earned.length,
        })}
      />
      <div className="flex flex-col gap-5">
        <Group title={t("framesFree")} className={grid}>
          {option("")}
          {free.map(option)}
        </Group>
        <Group
          title={t("framesEarned")}
          count={badges("groupCount", {
            earned: earned.filter(has).length,
            total: earned.length,
          })}
          className={grid}
        >
          {earned.map((p) =>
            has(p) ? (
              option(p)
            ) : (
              <LockedHint
                key={p}
                badge={BANNER_UNLOCKS[p]!}
                label={label(p)}
                masc
              >
                {(hint) => (
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-label={t("lockedOption", { name: label(p) })}
                    {...hint}
                    className="relative flex w-full cursor-help flex-col gap-1.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                  >
                    <ProfileBanner
                      preset={p}
                      className="aspect-[3/1] w-full rounded-lg border border-dashed border-border-default opacity-40 grayscale-[60%]"
                    />
                    <LockMark />
                    <span className="px-0.5 text-xs text-text-subtle">
                      {label(p)}
                    </span>
                  </button>
                )}
              </LockedHint>
            ),
          )}
        </Group>
      </div>
    </fieldset>
  );
}

/** Amostra redonda de uma cor (as animadas mudam de cor, como no perfil). */
function Swatch({
  accent,
  className = "",
  children,
}: {
  accent: Accent;
  className?: string;
  children?: ReactNode;
}) {
  const animation = accentAnimation(accent);
  const color = animation ? "var(--accent-anim)" : ACCENT_COLORS[accent];
  const s: CSSProperties & Record<string, string | undefined> = {
    background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
    ...(animation ? { "--accent-anim": ACCENT_COLORS[accent], animation } : {}),
  };
  return (
    <span
      aria-hidden="true"
      className={`flex size-10 items-center justify-center rounded-full transition ${className}`}
      style={s}
    >
      {children}
    </span>
  );
}

/** Cor de destaque do perfil: as livres e as animadas, por conquista. */
export function AccentPicker({
  value,
  onChange,
  unlockedBadges = [],
}: Omit<PickerProps, "disabled">) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const badges = useTranslations("Badges");
  const current = isAccent(value) ? value : "azul";
  const { hidden, granted } = useCatalog();
  const shown = (a: Accent) => !hidden.accent.includes(a);
  const free = FREE_ACCENTS.filter(shown);
  const earned = ACCENTS.filter((a) => ACCENT_UNLOCKS[a] && shown(a));
  const has = (a: Accent) => unlockedBadges.includes(ACCENT_UNLOCKS[a]!) || granted.accent.includes(a);
  const unlocked = free.length + earned.filter(has).length;
  const grid = "grid grid-cols-6 gap-2.5 sm:grid-cols-12";

  const option = (a: Accent) => {
    const on = current === a;
    return (
      <HintedOption
        key={a}
        badge={ACCENT_UNLOCKS[a]}
        title={style(`accent_${a}`)}
        unlockedStatus={t("available")}
        className="flex justify-center"
      >
        {(parts) => (
          <label
            {...parts.label}
            className={`relative flex cursor-pointer justify-center rounded-full ${FOCUS}`}
          >
            <input
              type="radio"
              name="accentChoice"
              className="sr-only top-1/2 left-1/2"
              checked={on}
              onChange={() => onChange(a)}
              aria-label={style(`accent_${a}`)}
              {...parts.input}
            />
            <Swatch
              accent={a}
              className={
                on
                  ? "ring-2 ring-text-primary ring-offset-2 ring-offset-bg-surface"
                  : "hover:scale-105"
              }
            >
              {on ? (
                <Check
                  className="size-4 text-white drop-shadow"
                  strokeWidth={3}
                />
              ) : null}
            </Swatch>
          </label>
        )}
      </HintedOption>
    );
  };

  return (
    <fieldset className="flex flex-col">
      <legend className="sr-only">{t("accent")}</legend>
      <PickerHeader
        title={t("accent")}
        selected={style(`accent_${current}`)}
        count={t("countUnlocked", { unlocked, total: free.length + earned.length })}
      />
      <div className="flex flex-col gap-5">
        <Group title={t("framesFree")} className={grid}>
          {free.map(option)}
        </Group>
        <Group
          title={t("framesEarned")}
          count={badges("groupCount", {
            earned: earned.filter(has).length,
            total: earned.length,
          })}
          className={grid}
        >
          {earned.map((a) =>
            has(a) ? (
              option(a)
            ) : (
              <LockedHint
                key={a}
                badge={ACCENT_UNLOCKS[a]!}
                label={style(`accent_${a}`)}
              >
                {(hint) => (
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-label={t("lockedOption", {
                      name: style(`accent_${a}`),
                    })}
                    {...hint}
                    className="relative flex w-full cursor-help justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                  >
                    <Swatch accent={a} className="opacity-35 grayscale-[50%]" />
                    <LockMark className="-top-1 right-0" />
                  </button>
                )}
              </LockedHint>
            ),
          )}
        </Group>
      </div>
    </fieldset>
  );
}
