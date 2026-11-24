import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileEditor } from "@/components/social/profile-editor/profile-editor";
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-10">
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
    <ProfileEditor
      username={profile.username}
      tags={tags}
<<<<<<< HEAD
      avatarUrl={profile.avatarUrl}
      bannerUrl={profile.bannerUrl}
=======
>>>>>>> 1069785f702d8fac9ee2b16c77c31bec209f5fbd
      initial={{
        displayName: profile.displayName ?? "",
        bio: profile.bio ?? "",
        headline: profile.headline ?? "",
        location: profile.location ?? "",
        status: profile.status ?? "",
        github: profile.links.github ?? "",
        linkedin: profile.links.linkedin ?? "",
        x: profile.links.x ?? "",
        youtube: profile.links.youtube ?? "",
        site: profile.links.site ?? "",
        bannerPreset: profile.bannerPreset ?? "",
        avatarFrame: profile.avatarFrame ?? "",
        accent: profile.accent ?? "",
        tags: profile.tags,
      }}
    />
  );
}
