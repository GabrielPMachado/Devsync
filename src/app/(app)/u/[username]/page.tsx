import { CalendarDays, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { TagChip } from "@/components/ui/tag-chip";
import { normalizeUsername } from "@/lib/auth/username";
import { getViewer } from "@/lib/auth/viewer";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type Params = PageProps<"/u/[username]">["params"];

async function loadProfile(raw: string) {
  if (!getSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, followers_count, following_count, created_at, profile_tags(tags(slug))")
    .eq("username", normalizeUsername(decodeURIComponent(raw)))
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${normalizeUsername(decodeURIComponent(username))} · Devsync` };
}

export default function ProfilePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-bg-surface" />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: { params: Params }) {
  const { username } = await params;
  const [profile, viewer] = await Promise.all([loadProfile(username), getViewer()]);
  if (!profile?.username) notFound();

  const t = await getTranslations("Profile");
  const nav = await getTranslations("Nav");
  const format = await getFormatter();
  const name = profile.display_name || profile.username;
  const mine = viewer?.id === profile.id;
  // Sem tipos gerados do banco, o embed vem tipado como lista; na prática é um objeto.
  const tags = (profile.profile_tags ?? []).flatMap((pt) => [pt.tags as unknown as { slug: string } | null].flat()).flatMap((tag) => (tag ? [tag.slug] : []));

  return (
    <article className="flex flex-col gap-6">
      <div aria-hidden="true" className="h-28 rounded-2xl bg-[linear-gradient(135deg,rgb(37_99_235/0.55),rgb(34_211_238/0.18))] md:h-36" />
      <div className="-mt-14 flex flex-col gap-4 px-2 md:-mt-16 md:px-6">
        <div className="flex items-end justify-between gap-4">
          <Avatar name={name} src={profile.avatar_url} size="lg" className="size-24 border-4 border-bg-base text-3xl" />
          {mine ? (
            <form action="/auth/sair" method="post" className="md:hidden">
              <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <LogOut className="size-4" aria-hidden="true" />
                {nav("signOut")}
              </button>
            </form>
          ) : null}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">{name}</h1>
          <p className="font-mono text-sm text-text-muted">@{profile.username}</p>
        </div>
        {profile.bio ? <p className="text-sm leading-relaxed text-text-secondary">{profile.bio}</p> : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            {t("joined", { date: format.dateTime(new Date(profile.created_at), { month: "short", year: "numeric" }) })}
          </span>
          <span>{t("followers", { count: profile.followers_count })}</span>
          <span>{t("following", { count: profile.following_count })}</span>
        </div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((slug) => (
              <TagChip key={slug} name={slug} />
            ))}
          </div>
        ) : null}
        <p className="rounded-xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-text-muted">{t("soon")}</p>
      </div>
    </article>
  );
}
