import { useTranslations } from "next-intl";
import { isBadgeKey } from "@/lib/social/badges";
import { BadgeIcon } from "./badge-icon";

type Props = { badges: readonly string[]; name: string };

/** Até 3 insígnias ao lado do nome. O nome aparece ao passar o mouse ou tocar (foco). */
export function ProfileBadges({ badges, name }: Props) {
  const t = useTranslations("Badges");
  const shown = badges.filter(isBadgeKey).slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <ul className="inline-flex items-center gap-1.5 align-middle" aria-label={t("shown", { name })}>
      {shown.map((b) => (
        <li key={b} className="group relative inline-flex">
          {/* Botão sem ação: dá parada de Tab e toque para mostrar o nome (dica visual). */}
          <button type="button" className="inline-flex cursor-default rounded-full">
            <BadgeIcon badge={b} />
            <span className="sr-only">{t(`${b}_name`)}</span>
          </button>
          <span
            role="tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-default bg-bg-elevated px-2 py-1 text-xs font-medium text-text-primary opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            {t(`${b}_name`)}
          </span>
        </li>
      ))}
    </ul>
  );
}
