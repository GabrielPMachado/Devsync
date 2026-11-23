import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

/** Página que ainda vai ganhar conteúdo nos próximos subprojetos. */
export function ComingSoon({ title, text }: { title: string; text: string }) {
  const t = useTranslations("ComingSoon");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="flex items-center gap-1.5 rounded-full border border-border-default bg-brand-accent-soft px-3 py-1 font-mono text-xs text-brand-accent">
        <Sparkles className="size-3.5" aria-hidden="true" />
        {t("badge")}
      </span>
      <h1 className="font-display text-3xl font-bold text-text-primary">{title}</h1>
      <p className="text-base leading-relaxed text-text-secondary">{text}</p>
    </main>
  );
}
