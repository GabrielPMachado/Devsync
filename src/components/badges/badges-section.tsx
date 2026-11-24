"use client";

import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BADGE_KEYS, SHOWN_BADGES_MAX, sanitizeShownBadges, type BadgeKey } from "@/lib/social/badges";
import { BadgeIcon } from "./badge-icon";

type Props = {
  /** Insígnias que a pessoa já conquistou. */
  earned: readonly BadgeKey[];
  /** As que estão exibidas hoje (profiles.shown_badges). */
  initial: readonly string[];
  /** Nome dos campos escondidos enviados com o formulário (um por insígnia marcada). */
  name?: string;
  onChange?: (shown: BadgeKey[]) => void;
};

/**
 * Seção "Insígnias" do editar perfil: todas as insígnias, as conquistadas coloridas,
 * as outras apagadas com "como ganhar". Marca até 3 para exibir ao lado do nome.
 */
export function BadgesSection({ earned, initial, name = "shown_badges", onChange }: Props) {
  const t = useTranslations("Badges");
  const [shown, setShown] = useState<BadgeKey[]>(() => sanitizeShownBadges([...initial], earned));
  const full = shown.length >= SHOWN_BADGES_MAX;

  function toggle(b: BadgeKey) {
    const next = shown.includes(b) ? shown.filter((x) => x !== b) : full ? shown : [...shown, b];
    setShown(next);
    onChange?.(next);
  }

  return (
    <fieldset id="insignias" className="flex flex-col gap-3">
      <legend className="text-base font-semibold text-text-primary">{t("sectionTitle")}</legend>
      <p className="text-sm text-text-muted">{t("sectionHint")}</p>
      {/* Diz à ação de salvar que a seção veio no formulário (sem ela, as exibidas não mudam). */}
      <input type="hidden" name="shownBadgesSet" value="1" />
      {shown.map((b) => (
        <input key={b} type="hidden" name={name} value={b} />
      ))}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BADGE_KEYS.map((b) => {
          const has = earned.includes(b);
          const on = shown.includes(b);
          const label = t(`${b}_name`);
          if (!has) {
            return (
              <li key={b} className="flex items-center gap-3 rounded-lg border border-dashed border-border-default p-3">
                <BadgeIcon badge={b} size="md" muted />
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-muted">
                    {label}
                    <Lock className="size-3.5" aria-label={t("locked")} />
                  </span>
                  <span className="text-xs text-text-subtle">{t("howTo", { how: t(`${b}_how`) })}</span>
                </span>
              </li>
            );
          }
          return (
            <li key={b}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(b)}
                title={!on && full ? t("limit") : undefined}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  on ? "border-brand-accent bg-bg-elevated" : "border-border-default bg-bg-surface hover:bg-bg-elevated"
                }`}
              >
                <BadgeIcon badge={b} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-text-primary">{label}</span>
                  <span className="text-xs text-text-muted">{t(`${b}_how`)}</span>
                </span>
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-brand-accent bg-brand-accent text-bg-base" : "border-border-default"}`}
                  aria-hidden="true"
                >
                  {on ? <Check className="size-3.5" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {full ? <p className="text-xs text-text-muted" role="status">{t("limit")}</p> : null}
    </fieldset>
  );
}
