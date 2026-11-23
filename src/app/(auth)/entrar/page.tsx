import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BrandPanel } from "@/components/auth/brand-panel";
import { LoginCard } from "@/components/auth/login-card";
import { Logo } from "@/components/brand/logo";
import { routeFor } from "@/lib/auth/route-for";
import { safeNext } from "@/lib/auth/safe-next";
import { getViewer } from "@/lib/auth/viewer";
import { getSupabaseEnv } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth");
  return { title: `${t("title")} · Devsync` };
}

type SearchParams = PageProps<"/entrar">["searchParams"];

/** Lê a URL e a sessão, então fica dentro de <Suspense>; o resto da tela é estático. */
async function Card({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const go = routeFor("auth", await getViewer(), next);
  if (go) redirect(go);

  const erro = typeof params.erro === "string" ? params.erro : null;
  const notice = !getSupabaseEnv() ? "config" : erro === "link" || erro === "github" ? erro : null;
  return <LoginCard next={next} notice={notice} />;
}

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const t = await getTranslations("Auth");

  return (
    <main className="flex flex-1">
      <BrandPanel />
      <div className="relative flex flex-1 flex-col lg:items-center lg:justify-center lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgb(37_99_235/0.25),rgb(34_211_238/0)_60%)] lg:hidden"
        />
        <div className="relative flex flex-col gap-7 px-6 pt-14 lg:hidden">
          <Logo size={34} />
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-[0.08em] text-brand-accent uppercase">{t("brandTagline")}</p>
            <p className="font-display text-3xl font-extrabold text-text-primary">{t("brandMobileTitle")}</p>
            <p className="text-base leading-relaxed text-text-muted">{t("brandMobileText")}</p>
          </div>
        </div>
        <div className="relative mt-auto px-6 pt-10 pb-8 lg:mt-0 lg:w-full lg:max-w-[440px] lg:rounded-2xl lg:border lg:border-border-default lg:bg-bg-surface lg:p-10 lg:shadow-2xl lg:shadow-black/40">
          <Suspense fallback={<LoginCard next="/" notice={null} />}>
            <Card searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
