import { BookOpen, Play, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";

/** Lado esquerdo da tela Entrar no desktop (tela 01 do Figma). */
export function BrandPanel() {
  const t = useTranslations("Auth");
  const items = [
    { Icon: Play, text: t("highlightDemos") },
    { Icon: BookOpen, text: t("highlightStudies") },
    { Icon: Users, text: t("highlightPeople") },
  ];

  return (
    <aside className="relative hidden flex-1 flex-col justify-between border-r border-border-default bg-bg-surface px-18 py-16 lg:flex">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgb(37_99_235/0.28),rgb(34_211_238/0.06))]" />
      <div className="relative">
        <Logo size={40} />
      </div>
      <div className="relative flex max-w-xl flex-col gap-5">
        <p className="text-xs font-semibold tracking-[0.08em] text-brand-accent uppercase">{t("brandTagline")}</p>
        <p className="font-display text-5xl leading-tight font-extrabold whitespace-pre-line text-text-primary">{t("brandTitle")}</p>
        <ul className="flex flex-col gap-3.5 pt-3">
          {items.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="rounded-md bg-brand-accent-soft p-2 text-brand-accent">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="text-lg text-text-secondary">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-sm text-text-muted">{t("footer")}</p>
    </aside>
  );
}
