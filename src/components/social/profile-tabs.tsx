import { useTranslations } from "next-intl";
import Link from "next/link";

export type ProfileTab = "projetos" | "perguntas" | "respostas";

/** Abas do perfil (links, para funcionar sem JavaScript e ter URL própria). */
export function ProfileTabs({ base, active, counts }: { base: string; active: ProfileTab; counts: Record<ProfileTab, number> }) {
  const t = useTranslations("Social");
  const tabs: ProfileTab[] = ["projetos", "perguntas", "respostas"];
  return (
    <nav aria-label={t("profileSections")} className="border-b border-border-default">
      <ul className="flex gap-6 overflow-x-auto">
        {tabs.map((tab) => {
          const on = tab === active;
          return (
            <li key={tab}>
              <Link
                href={tab === "projetos" ? base : `${base}?aba=${tab}`}
                aria-current={on ? "page" : undefined}
                scroll={false}
                className={`-mb-px inline-flex border-b-2 px-0.5 py-2.5 text-sm whitespace-nowrap ${on ? "border-brand-accent font-semibold text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
              >
                {t(`tab_${tab}`, { count: counts[tab] })}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
