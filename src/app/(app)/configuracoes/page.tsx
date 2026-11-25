import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BadgesSection } from "@/components/badges/badges-section";
import { CatalogProvider } from "@/components/social/profile-editor/catalog-context";
import { EditorSection } from "@/components/social/profile-editor/editor-section";
import { ProfileEditor } from "@/components/social/profile-editor/profile-editor";
import { getViewer } from "@/lib/auth/viewer";
import { hiddenItems } from "@/lib/moderation/catalog";
import { getCatalogRows } from "@/lib/moderation/catalog-state";
import { getItemGrants } from "@/lib/moderation/profile-queries";
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
  const [profile, tags, catalogRows, grants] = await Promise.all([getProfile(viewer.username), listTags(), getCatalogRows(), getItemGrants(viewer.id)]);
  if (!profile) redirect("/");
  const tb = await getTranslations("Badges");
  const earned = profile.badges.map((b) => b.badge);
  // Itens desligados pela moderação somem do editor, menos os que a pessoa já usa ou ganhou à mão.
  const hidden = hiddenItems(catalogRows, { banner: profile.bannerPreset, accent: profile.accent, frame: profile.avatarFrame, grants, earnedBadges: earned });
  const grantedFrames = grants.filter((g) => g.kind === "frame").map((g) => g.key);
  const initial = {
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
  };
  // O editor guarda o rascunho em estado e o Next mantém a página montada entre
  // navegações: sem a chave, voltar aqui depois de salvar mostrava o rascunho
  // antigo (ou o vazio). Dados novos do banco = editor novo.
  const saved = JSON.stringify([initial, profile.avatarUrl, profile.bannerUrl, profile.shownBadges, earned, hidden, grantedFrames]);
  return (
    <CatalogProvider hidden={hidden} grantedFrames={grantedFrames}>
    <ProfileEditor
      key={saved}
      username={profile.username}
      userId={viewer.id}
      tags={tags}
      avatarUrl={profile.avatarUrl}
      bannerUrl={profile.bannerUrl}
      unlockedBadges={earned}
      badgesSection={
        <EditorSection id="insignias" title={tb("sectionTitle")} help={tb("sectionHint")}>
          <BadgesSection earned={earned} initial={profile.shownBadges} />
        </EditorSection>
      }
      initial={initial}
    />
    </CatalogProvider>
  );
}
