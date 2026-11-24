import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Gate } from "@/components/auth/gate";
import { ConnectedPublishForm } from "@/components/projects/publish-form-connected";
import { OverlayNotice } from "@/components/projects/publish-form";
import { getGithubLogin, listTags } from "@/lib/projects/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Publish");
  return { title: t("metaTitle") };
}

export default async function NewProjectPage() {
  const t = await getTranslations("Publish");
  return (
    <main className="mx-auto grid grid-cols-1 w-full max-w-[1120px] flex-1 gap-8 px-4 py-6 md:px-6 md:py-10 lg:grid-cols-[minmax(0,760px)_1fr]">
      <Suspense fallback={null}>
        <Gate area="private" next="/projetos/novo" />
      </Suspense>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-text-primary">{t("title")}</h1>
          <p className="text-text-muted">{t("subtitle")}</p>
        </header>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
          <Form />
        </Suspense>
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <OverlayNotice />
        </div>
      </div>
    </main>
  );
}

async function Form() {
  const [tags, githubUser] = await Promise.all([listTags(), getGithubLogin()]);
  return <ConnectedPublishForm tags={tags} githubUser={githubUser} />;
}
