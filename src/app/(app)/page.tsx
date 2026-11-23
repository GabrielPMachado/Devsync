import { useTranslations } from "next-intl";
import Link from "next/link";
import { Suspense } from "react";
import { HomeHero } from "@/components/home-hero";
import { buttonClasses } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 py-16">
      <HomeHero />
      <Suspense fallback={<div className="h-11" />}>
        <HomeAction />
      </Suspense>
    </main>
  );
}

async function HomeAction() {
  const viewer = await getViewer();
  return <HomeActionView name={viewer?.username ? viewer.displayName || `@${viewer.username}` : null} />;
}

function HomeActionView({ name }: { name: string | null }) {
  const t = useTranslations("Home");
  const s = useTranslations("ComingSoon");
  if (!name) {
    return (
      <Link href="/entrar" className={buttonClasses({ size: "lg" })}>
        {t("signIn")}
      </Link>
    );
  }
  return (
    <section className="mx-6 flex max-w-md flex-col items-center gap-1 rounded-xl border border-border-default bg-bg-surface px-6 py-5 text-center">
      <p className="font-display text-lg font-bold text-text-primary">{s("hello", { name })}</p>
      <p className="text-sm text-text-muted">{s("feed")}</p>
    </section>
  );
}
