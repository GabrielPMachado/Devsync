import { CircleHelp, FolderGit2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Suspense } from "react";
import { HomeHero } from "@/components/home-hero";
import { FeedList } from "@/components/social/feed-list";
import { Unanswered, WhoToFollow } from "@/components/social/side-panels";
import { buttonClasses } from "@/components/ui/button";
import { getViewer, type Viewer } from "@/lib/auth/viewer";
import { followedTags, loadFeed, loadLatest } from "@/lib/social/queries";

type Search = PageProps<"/">["searchParams"];

export default function Home({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 w-full max-w-[1280px] animate-pulse" />}>
      <HomeFor searchParams={searchParams} />
    </Suspense>
  );
}

/** Cursor da paginação: só datas válidas. */
function cursorOf(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
}

async function HomeFor({ searchParams }: { searchParams: Search }) {
  const viewer = await getViewer();
  if (!viewer?.username) return <Visitor />;
  const sp = await searchParams;
  return <Feed viewer={viewer} before={cursorOf(sp.antes)} />;
}

function Visitor() {
  const t = useTranslations("Home");
  return (
    <main className="flex flex-1 flex-col items-center gap-12 py-16">
      <div className="flex flex-col items-center gap-8">
        <HomeHero />
        <Link href="/entrar" className={buttonClasses({ size: "lg" })}>
          {t("signIn")}
        </Link>
      </div>
      <Suspense fallback={null}>
        <Latest />
      </Suspense>
    </main>
  );
}

async function Latest() {
  const items = await loadLatest(8);
  if (items.length === 0) return null;
  const t = await getTranslations("Feed");
  return (
    <section className="flex w-full max-w-[760px] flex-col gap-4 px-4">
      <h2 className="font-display text-lg font-bold text-text-primary">{t("latest")}</h2>
      <FeedList items={items} basePath="/" label={t("latest")} />
    </section>
  );
}

async function Feed({ viewer, before }: { viewer: Viewer; before: string | null }) {
  const t = await getTranslations("Feed");
  const [{ items, next }, tags] = await Promise.all([loadFeed(before), followedTags(viewer.id)]);
  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 gap-8 px-4 py-6 md:px-6 md:py-8">
      <aside className="hidden w-52 shrink-0 flex-col gap-3 lg:flex">
        <h2 className="text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">{t("tagsYouFollow")}</h2>
        {tags.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((slug) => (
              <li key={slug}>
                <Link href={`/tags/${slug}`} className="inline-flex items-center rounded-sm border border-border-default bg-bg-elevated px-2 py-0.5 font-mono text-xs text-text-secondary hover:border-border-strong hover:text-text-primary">
                  {slug}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/explorar" className="text-sm font-semibold text-text-link hover:underline">
          {t("moreTags")}
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
          <p className="flex-1 text-sm text-text-muted">{t("composer", { name: viewer.displayName || viewer.username || "" })}</p>
          <Link href="/projetos/novo" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <FolderGit2 className="size-4" aria-hidden="true" />
            {t("newProject")}
          </Link>
          <Link href="/estudos/perguntar" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <CircleHelp className="size-4" aria-hidden="true" />
            {t("newQuestion")}
          </Link>
        </div>
        <h1 className="sr-only">{t("title")}</h1>
        {items.length === 0 && !before ? (
          <>
            <p className="rounded-xl border border-dashed border-border-default px-4 py-10 text-center text-sm text-text-muted">{t("empty")}</p>
            <Suspense fallback={null}>
              <Latest />
            </Suspense>
          </>
        ) : (
          <FeedList items={items} basePath="/" label={t("yours")} />
        )}
        {next ? (
          <Link href={`/?antes=${encodeURIComponent(next)}`} className={`${buttonClasses({ variant: "secondary" })} self-center`}>
            {t("more")}
          </Link>
        ) : items.length > 0 ? (
          <p className="text-center text-sm text-text-subtle">{t("end")}</p>
        ) : null}
      </div>

      <aside className="hidden w-72 shrink-0 flex-col gap-5 xl:flex">
        <Suspense fallback={null}>
          <WhoToFollow viewerId={viewer.id} path="/" />
        </Suspense>
        <Suspense fallback={null}>
          <Unanswered />
        </Suspense>
      </aside>
    </main>
  );
}
