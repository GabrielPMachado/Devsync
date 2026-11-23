import { useTranslations } from "next-intl";

export function HomeHero() {
  const t = useTranslations("Home");

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 text-center">
      <span className="rounded-full border border-border-default bg-brand-accent-soft px-3 py-1 font-mono text-xs text-brand-accent">
        {t("status")}
      </span>
      <p className="font-display text-5xl font-extrabold tracking-tight">
        Dev<span className="text-brand-gradient">sync</span>
      </p>
      <p className="text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">
        {t("tagline")}
      </p>
      <h1 className="font-display text-3xl font-bold text-text-primary">{t("title")}</h1>
      <p className="text-base leading-relaxed text-text-secondary">{t("description")}</p>
    </section>
  );
}
