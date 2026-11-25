"use client";

import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { BADGE_GROUPS, BADGE_KEYS, SHOWN_BADGES_MAX, sanitizeShownBadges, type BadgeKey } from "@/lib/social/badges";
import { Hint } from "@/components/ui/hint";
import { BadgeIcon } from "./badge-icon";
import { lowerFirst, UnlockInfo } from "./unlock-info";

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
 * as outras apagadas. Ao passar o mouse ou tocar, uma dica mostra o requisito: cumprido
 * (cadeado aberto) ou o que falta (cadeado fechado). Marca até 3 para exibir ao lado do nome.
 */
export function BadgesSection({ earned, initial, name = "shown_badges", onChange }: Props) {
  const t = useTranslations("Badges");
  const [shown, setShown] = useState<BadgeKey[]>(() => sanitizeShownBadges([...initial], earned));
  const full = shown.length >= SHOWN_BADGES_MAX;
  const baseId = useId();
  const earnedCount = BADGE_KEYS.filter((b) => earned.includes(b)).length;

  function toggle(b: BadgeKey) {
    const next = shown.includes(b) ? shown.filter((x) => x !== b) : full ? shown : [...shown, b];
    setShown(next);
    onChange?.(next);
  }

  return (
    // Título e ajuda vêm do cartão do editor (EditorSection); a legenda fica para leitores de tela.
    <fieldset id="insignias" className="flex scroll-mt-24 flex-col gap-5">
      <legend className="sr-only">{t("sectionTitle")}</legend>
      {/* Diz à ação de salvar que a seção veio no formulário (sem ela, as exibidas não mudam). */}
      <input type="hidden" name="shownBadgesSet" value="1" />
      {shown.map((b) => (
        <input key={b} type="hidden" name={name} value={b} />
      ))}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-text-secondary">{t("progress", { earned: earnedCount, total: BADGE_KEYS.length })}</span>
          <span className="text-text-muted">{t("shownCount", { count: shown.length, max: SHOWN_BADGES_MAX })}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-base" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${(earnedCount / BADGE_KEYS.length) * 100}%` }} />
        </div>
      </div>
      {BADGE_GROUPS.map((g) => (
        <div key={g.key} role="group" aria-labelledby={`${baseId}-${g.key}`} className="flex flex-col gap-2">
          <p id={`${baseId}-${g.key}`} className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
            {t(`group_${g.key}`)}
            <span className="font-medium tracking-normal normal-case tabular-nums text-text-muted">
              {t("groupCount", { earned: g.badges.filter((b) => earned.includes(b)).length, total: g.badges.length })}
            </span>
          </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {g.badges.map((b) => {
          const has = earned.includes(b);
          const on = shown.includes(b);
          const label = t(`${b}_name`);
          if (!has) {
            return (
              <li key={b} className="flex">
                <Hint
                  className="flex w-full"
                  content={
                    <UnlockInfo art={<BadgeIcon badge={b} size="md" />} title={label} unlocked={false} status={t("lockedShort")}>
                      <span>{t("howTo", { how: t(`${b}_how`) })}.</span>
                    </UnlockInfo>
                  }
                >
                  {(hint) => (
                    <button
                      type="button"
                      aria-disabled="true"
                      {...hint}
                      className="relative flex w-full cursor-help flex-col items-center gap-2 rounded-xl border border-dashed border-border-default p-3 text-center transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-border-focus"
                    >
                      <BadgeIcon badge={b} size="lg" muted />
                      <span className="text-xs font-medium text-text-muted">{label}</span>
                      <Lock className="absolute top-2 right-2 size-3.5 text-text-subtle" aria-label={t("locked")} />
                    </button>
                  )}
                </Hint>
              </li>
            );
          }
          const blocked = !on && full;
          return (
            <li key={b} className="flex">
              <Hint
                className="flex w-full"
                content={
                  <UnlockInfo art={<BadgeIcon badge={b} size="md" />} title={label} unlocked status={t("earned")}>
                    <span>{t("done", { how: lowerFirst(t(`${b}_how`)) })}.</span>
                  </UnlockInfo>
                }
              >
                {(hint) => (
                  <button
                    type="button"
                    aria-pressed={on}
                    // aria-disabled (e não disabled) para a dica ainda abrir ao passar o mouse ou tocar.
                    aria-disabled={blocked || undefined}
                    {...hint}
                    onClick={(ev) => {
                      hint.onClick(ev);
                      if (!blocked) toggle(b);
                    }}
                    className={`relative flex w-full flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-border-focus ${
                      on ? "border-brand-accent bg-brand-accent-soft" : "border-border-default bg-bg-surface hover:border-border-strong hover:bg-bg-elevated"
                    }`}
                  >
                    <BadgeIcon badge={b} size="lg" />
                    <span className="text-xs font-medium text-text-primary">{label}</span>
                    <span
                      className={`absolute top-2 right-2 flex size-4.5 items-center justify-center rounded-full border ${on ? "border-brand-accent bg-brand-accent text-bg-base" : "border-border-default"}`}
                      aria-hidden="true"
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                  </button>
                )}
              </Hint>
            </li>
          );
        })}
      </ul>
        </div>
      ))}
      {full ? <p className="text-xs text-text-muted" role="status">{t("limit")}</p> : null}
    </fieldset>
  );
}
