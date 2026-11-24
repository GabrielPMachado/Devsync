import { useFormatter, useTranslations } from "next-intl";
import { BADGE_KEYS, type EarnedBadge } from "@/lib/social/badges";
import { BadgeIcon } from "./badge-icon";

/** Bloco "Conquistas" do perfil: todas as insígnias conquistadas, na ordem do catálogo. */
export function AchievementsBlock({ badges }: { badges: readonly EarnedBadge[] }) {
  const t = useTranslations("Badges");
  const format = useFormatter();
  if (badges.length === 0) return null;
  const sorted = [...badges].sort((a, b) => BADGE_KEYS.indexOf(a.badge) - BADGE_KEYS.indexOf(b.badge));
  return (
    <section aria-labelledby="conquistas" className="flex flex-col gap-3">
      <h2 id="conquistas" className="flex items-baseline gap-2 text-sm font-semibold text-text-primary">
        {t("achievements")}
        <span className="text-xs font-normal text-text-muted">{t("achievementsCount", { count: badges.length })}</span>
      </h2>
      <ul className="flex flex-wrap gap-2">
        {sorted.map(({ badge, awardedAt }) => (
          <li key={badge} className="flex items-center gap-2 rounded-full border border-border-default bg-bg-surface py-1 pr-3 pl-1">
            <BadgeIcon badge={badge} />
            <span className="flex flex-col leading-tight">
              <span className="text-xs font-medium text-text-primary">{t(`${badge}_name`)}</span>
              <time dateTime={awardedAt} className="text-[11px] text-text-subtle">
                {t("earnedOn", { date: format.dateTime(new Date(awardedAt), { day: "numeric", month: "short", year: "numeric" }) })}
              </time>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
