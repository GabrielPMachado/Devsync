import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileForm } from "@/components/social/profile-form";
import { getViewer } from "@/lib/auth/viewer";
import { listTags } from "@/lib/projects/queries";
import { getProfile } from "@/lib/social/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: `${t("title")} · Devsync` };
}

export default async function SettingsPage() {
  const t = await getTranslations("Settings");
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>
        <p className="text-sm text-text-muted">{t("subtitle")}</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-bg-surface" />}>
        <Form />
      </Suspense>
    </main>
  );
}

async function Form() {
  const viewer = await getViewer();
  if (!viewer?.username) redirect("/entrar?next=%2Fconfiguracoes");
  const [profile, tags] = await Promise.all([getProfile(viewer.username), listTags()]);
  if (!profile) redirect("/");
  return (
    <ProfileForm
      username={profile.username}
      tags={tags}
      initial={{ displayName: profile.displayName ?? "", bio: profile.bio ?? "", github: profile.links.github ?? "", site: profile.links.site ?? "", tags: profile.tags }}
    />
  );
}
