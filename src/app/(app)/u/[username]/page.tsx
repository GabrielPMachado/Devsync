import { CalendarDays, CircleCheck, Globe, LogOut, Pencil, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GithubIcon } from "@/components/icons/github";
import { ReportButton } from "@/components/moderation/report-button";
import { ProjectCard } from "@/components/projects/project-card";
import { FollowButton } from "@/components/social/follow-button";
import { ProfileTabs, type ProfileTab } from "@/components/social/profile-tabs";
import { QuestionCard } from "@/components/studies/question-card";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { normalizeUsername } from "@/lib/auth/username";
import { getViewer } from "@/lib/auth/viewer";
import { followingSet, getProfile, getProfileStats, listAnswersBy, listProjectsBy, listQuestionsBy, type ProfileData } from "@/lib/social/queries";

type Params = PageProps<"/u/[username]">["params"];
type Search = PageProps<"/u/[username]">["searchParams"];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  let name = username;
  try {
    name = normalizeUsername(decodeURIComponent(username));
  } catch {}
  return { title: `@${name} · Devsync` };
}

export default function ProfilePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 py-6 md:px-6 md:py-8">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-bg-surface" />}>
        <Profile params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function tabOf(raw: string | string[] | undefined): ProfileTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "perguntas" || v === "respostas" ? v : "projetos";
}

async function Profile({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const [profile, viewer] = await Promise.all([getProfile(username), getViewer()]);
  if (!profile) notFound();
  const [stats, follows] = await Promise.all([getProfileStats(profile.id), followingSet(viewer?.id, [profile.id])]);

  const t = await getTranslations("Social");
  const nav = await getTranslations("Nav");
  const format = await getFormatter();
  const name = profile.displayName || profile.username;
  const mine = viewer?.id === profile.id;
  const base = `/@${profile.username}`;
  const tab = tabOf(sp.aba);
  const saved = sp.salvo === "1" && mine;

  return (
    <article className="flex flex-col gap-6">
      {saved ? (
        <p role="status" className="rounded-lg border border-status-success bg-status-success-soft px-4 py-3 text-sm text-status-success-text">
          {t("profileSaved")}
        </p>
      ) : null}
      <div aria-hidden="true" className="h-28 rounded-2xl border border-border-default bg-[linear-gradient(135deg,rgb(37_99_235/0.45),rgb(34_211_238/0.15))] md:h-40" />
      <div className="-mt-14 flex flex-col gap-4 px-2 md:-mt-16 md:flex-row md:items-end md:gap-6 md:px-6">
        <Avatar name={name} src={profile.avatarUrl} size="lg" className="size-24 border-4 border-bg-base text-3xl md:size-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-1 md:pb-1">
          <h1 className="font-display text-2xl font-bold text-text-primary md:text-3xl">{name}</h1>
          <p className="font-mono text-sm text-text-muted">@{profile.username}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:pb-1">
          {mine ? (
            <>
              <Link href="/configuracoes" className={buttonClasses({ variant: "secondary" })}>
                <Pencil className="size-4" aria-hidden="true" />
                {t("editProfile")}
              </Link>
              {/* No celular o menu da conta não aparece: o link da moderação fica aqui. */}
              {viewer?.isAdmin ? (
                <Link href="/admin" className={`${buttonClasses({ variant: "secondary" })} md:hidden`}>
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  {nav("moderation")}
                </Link>
              ) : null}
              <form action="/auth/sair" method="post" className="md:hidden">
                <button type="submit" className={buttonClasses({ variant: "ghost" })}>
                  <LogOut className="size-4" aria-hidden="true" />
                  {nav("signOut")}
                </button>
              </form>
            </>
          ) : (
            <>
              <FollowButton profileId={profile.id} username={profile.username} following={follows.has(profile.id)} signedIn={!!viewer} path={base} />
              <ReportButton target="profile" targetId={profile.id} signedIn={!!viewer?.username} />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-2 md:px-6">
        {profile.bio ? <p className="max-w-3xl text-base leading-relaxed text-text-secondary">{profile.bio}</p> : null}
        <ProfileDetails profile={profile} joined={format.dateTime(new Date(profile.createdAt), { month: "short", year: "numeric" })} />
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Stat href={`${base}/seguidores`} value={profile.followersCount} label={t("followersLabel", { count: profile.followersCount })} />
          <Stat href={`${base}/seguindo`} value={profile.followingCount} label={t("followingLabel")} />
          <Stat value={stats.projects} label={t("projectsLabel", { count: stats.projects })} />
          <Stat value={stats.answers} label={t("answersLabel", { count: stats.answers })} />
          <Stat value={stats.accepted} label={t("acceptedLabel", { count: stats.accepted })} />
        </dl>
        {profile.tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-text-secondary">{t("technologies")}</span>
            {profile.tags.map((slug) => (
              <Link key={slug} href={`/tags/${slug}`} className="inline-flex items-center rounded-sm border border-border-default bg-bg-elevated px-2 py-0.5 font-mono text-xs text-text-secondary hover:border-border-strong hover:text-text-primary">
                {slug}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <ProfileTabs base={base} active={tab} counts={{ projetos: stats.projects, perguntas: stats.questions, respostas: stats.answers }} />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-bg-surface" />}>
        <TabContent profile={profile} tab={tab} mine={mine} />
      </Suspense>
    </article>
  );
}

function Stat({ value, label, href }: { value: number; label: string; href?: string }) {
  const body = (
    <>
      <dd className="font-display font-bold text-text-primary">{value}</dd>
      <dt className="text-text-muted">{label}</dt>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-baseline gap-1.5 hover:underline">
      {body}
    </Link>
  ) : (
    <div className="flex items-baseline gap-1.5">{body}</div>
  );
}

async function ProfileDetails({ profile, joined }: { profile: ProfileData; joined: string }) {
  const t = await getTranslations("Social");
  const item = "flex items-center gap-1.5";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
      {profile.links.github ? (
        <a href={`https://github.com/${profile.links.github}`} rel="me noopener noreferrer nofollow" target="_blank" className={`${item} text-text-link hover:underline`}>
          <GithubIcon className="size-4" />
          github.com/{profile.links.github}
        </a>
      ) : null}
      {profile.links.site ? (
        <a href={profile.links.site} rel="me noopener noreferrer nofollow ugc" target="_blank" className={`${item} text-text-link hover:underline`}>
          <Globe className="size-4" aria-hidden="true" />
          {profile.links.site.replace(/^https:\/\//, "").replace(/\/$/, "")}
        </a>
      ) : null}
      <span className={item}>
        <CalendarDays className="size-4" aria-hidden="true" />
        {t("joined", { date: joined })}
      </span>
    </div>
  );
}

async function TabContent({ profile, tab, mine }: { profile: ProfileData; tab: ProfileTab; mine: boolean }) {
  const t = await getTranslations("Social");
  const format = await getFormatter();
  const now = new Date();
  const empty = (text: string) => <p className="rounded-xl border border-dashed border-border-default px-4 py-10 text-center text-sm text-text-muted">{text}</p>;

  if (tab === "perguntas") {
    const questions = await listQuestionsBy(profile.id);
    if (questions.length === 0) return empty(mine ? t("emptyMyQuestions") : t("emptyQuestions"));
    return (
      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <QuestionCard key={q.id} question={q} now={now} />
        ))}
      </div>
    );
  }
  if (tab === "respostas") {
    const answers = await listAnswersBy(profile.id);
    if (answers.length === 0) return empty(mine ? t("emptyMyAnswers") : t("emptyAnswers"));
    return (
      <ul className="flex flex-col gap-2">
        {answers.map((a) => (
          <li key={a.id} className="flex items-center gap-4 rounded-xl border border-border-default bg-bg-surface px-4 py-3">
            <span className={`inline-flex min-w-12 items-center justify-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-semibold ${a.accepted ? "border-status-success bg-status-success-soft text-status-success-text" : "border-border-strong bg-bg-elevated text-text-secondary"}`}>
              {a.accepted ? <CircleCheck className="size-3.5" aria-label={t("acceptedAnswer")} /> : null}
              {a.score}
            </span>
            <Link href={`/estudos/${a.question.slug}#resposta-${a.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-text-link hover:underline">
              {a.question.title}
            </Link>
            <span className="shrink-0 text-xs text-text-muted">{format.relativeTime(new Date(a.createdAt), now)}</span>
          </li>
        ))}
      </ul>
    );
  }
  const projects = await listProjectsBy(profile.id);
  if (projects.length === 0) return empty(mine ? t("emptyMyProjects") : t("emptyProjects"));
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} basePath={`/@${profile.username}`} />
      ))}
    </div>
  );
}
