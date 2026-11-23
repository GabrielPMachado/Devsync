import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { routeFor } from "@/lib/auth/route-for";
import { validateUsername } from "@/lib/auth/username";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Onboarding");
  return { title: `${t("title")} · Devsync` };
}

export default async function BoasVindasPage() {
  const t = await getTranslations("Onboarding");
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center px-4 py-4 sm:px-8 sm:py-5">
        <Logo size={30} />
      </header>
      <main className="flex flex-1 justify-center px-4 pt-2 pb-16 sm:pt-6">
        <div className="flex w-full max-w-[560px] flex-col gap-6 sm:rounded-2xl sm:border sm:border-border-default sm:bg-bg-surface sm:p-10">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-[0.08em] text-brand-accent uppercase">{t("eyebrow")}</p>
            <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>
            <p className="text-sm leading-relaxed text-text-muted">{t("subtitle")}</p>
          </div>
          <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-elevated" />}>
            <Form />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

/** Lê a sessão e as tags, então fica dentro de <Suspense>. */
async function Form() {
  const viewer = await getViewer();
  const go = routeFor("onboarding", viewer);
  if (go || !viewer) redirect(go ?? "/entrar");

  const supabase = await createClient();
  const [{ data: tags }, { data: claims }] = await Promise.all([
    supabase.from("tags").select("slug, name").order("name"),
    supabase.auth.getClaims(),
  ]);
  // Sugestão: o @ do GitHub, se for válido aqui.
  const meta = (claims?.claims?.user_metadata ?? {}) as { user_name?: string };
  const fromGithub = meta.user_name ? validateUsername(meta.user_name) : null;
  return (
    <OnboardingForm
      initialName={viewer.displayName ?? ""}
      initialUsername={fromGithub?.ok ? fromGithub.username : ""}
      avatarUrl={viewer.avatarUrl}
      tags={tags ?? []}
    />
  );
}
