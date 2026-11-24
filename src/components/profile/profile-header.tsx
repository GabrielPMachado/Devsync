import { Globe, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { LinkedinIcon, XIcon, YoutubeIcon } from "@/components/icons/brands";
import { GithubIcon } from "@/components/icons/github";
import { Avatar } from "@/components/ui/avatar";
import { accentStyle } from "@/lib/profile/accent";
import type { ProfileData, ProfileLinks } from "@/lib/social/queries";
import { AvatarFrame } from "./avatar-frame";
import { ProfileBanner } from "./profile-banner";

export type ProfileHeaderData = Pick<
  ProfileData,
  "username" | "displayName" | "avatarUrl" | "headline" | "location" | "status" | "bannerUrl" | "bannerPreset" | "avatarFrame" | "accent" | "links" | "followersCount" | "followingCount"
>;

type LinkKind = keyof ProfileLinks;
const LINK_ORDER: LinkKind[] = ["github", "linkedin", "x", "youtube", "site"];
const LINK_ICON: Record<LinkKind, (p: { className?: string }) => ReactNode> = {
  github: GithubIcon,
  linkedin: LinkedinIcon,
  x: XIcon,
  youtube: YoutubeIcon,
  site: ({ className }) => <Globe className={className} aria-hidden="true" />,
};

/** Endereço completo de cada link (o banco guarda só o usuário; o site já vem com https). */
export function linkHref(kind: LinkKind, value: string): string {
  switch (kind) {
    case "github":
      return `https://github.com/${value}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${value}`;
    case "x":
      return `https://x.com/${value}`;
    case "youtube":
      return `https://www.youtube.com/@${value}`;
    case "site":
      return value;
  }
}

type Props = {
  profile: ProfileHeaderData;
  /** Botões à direita (editar, seguir, denunciar). */
  actions?: ReactNode;
  /** Base do perfil (/@ana) para os links de seguidores; sem ela (prévia), os números não viram links. */
  basePath?: string;
  /** "Na Devsync desde ..." já formatado. */
  joined?: ReactNode;
};

/**
 * Cabeçalho do perfil: banner, foto com borda, nome, cargo, status, local, links e números.
 * Usado na página /@usuario e reaproveitável na prévia ao vivo do editar perfil.
 */
export function ProfileHeader({ profile, actions, basePath, joined }: Props) {
  const t = useTranslations("ProfileHeader");
  const style = useTranslations("ProfileStyle");
  const name = profile.displayName || profile.username;
  const links = LINK_ORDER.flatMap((kind) => {
    const value = profile.links[kind];
    return value ? [{ kind, href: linkHref(kind, value) }] : [];
  });

  return (
    <header className="flex flex-col" style={accentStyle(profile.accent) as CSSProperties}>
      <ProfileBanner bannerUrl={profile.bannerUrl} preset={profile.bannerPreset} className="aspect-[3/1] max-h-56 w-full rounded-2xl border border-border-default md:aspect-auto md:h-52" />
      <div className="flex flex-col gap-3 px-2 md:flex-row md:items-start md:gap-6 md:px-6">
        {/* Só a foto sobe sobre o banner; nome e botões ficam abaixo dele. */}
        <div className="relative -mt-12 self-start md:-mt-16">
          <AvatarFrame frame={profile.avatarFrame}>
            <Avatar name={name} src={profile.avatarUrl} size="lg" className="size-24 border-4 border-bg-base text-3xl md:size-28" />
          </AvatarFrame>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 md:pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 font-display text-2xl font-bold break-words text-text-primary md:text-3xl">{name}</h1>
            {/* INSÍGNIAS: <ProfileBadges /> aqui, ao lado do nome (até 3). */}
          </div>
          <p className="font-mono text-sm text-text-muted">@{profile.username}</p>
          {profile.headline ? <p className="text-base break-words text-text-secondary">{profile.headline}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 md:pt-3">{actions}</div> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-2 text-sm text-text-muted md:px-6">
        {profile.status ? (
          <span
            data-status={profile.status}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-text)]"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--accent-text)]" />
            {style(`status_${profile.status}`)}
          </span>
        ) : null}
        {profile.location ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t("location")}</span>
            {profile.location}
          </span>
        ) : null}
        {joined ? <span>{joined}</span> : null}
        <span className="inline-flex items-center gap-1.5">
          {basePath ? (
            <>
              <Link href={`${basePath}/seguidores`} className="hover:text-text-primary hover:underline">
                {t("followers", { count: profile.followersCount })}
              </Link>
              <span aria-hidden="true">·</span>
              <Link href={`${basePath}/seguindo`} className="hover:text-text-primary hover:underline">
                {t("following", { count: profile.followingCount })}
              </Link>
            </>
          ) : (
            <>
              <span>{t("followers", { count: profile.followersCount })}</span>
              <span aria-hidden="true">·</span>
              <span>{t("following", { count: profile.followingCount })}</span>
            </>
          )}
        </span>
        {links.length > 0 ? (
          <ul aria-label={t("links", { name })} className="flex items-center gap-1 md:ml-auto">
            {links.map(({ kind, href }) => {
              const Icon = LINK_ICON[kind];
              return (
                <li key={kind}>
                  <a
                    href={href}
                    target="_blank"
                    rel={`me noopener noreferrer nofollow${kind === "site" ? " ugc" : ""}`}
                    aria-label={t(`link_${kind}`)}
                    title={kind === "site" ? href.replace(/^https:\/\//, "").replace(/\/$/, "") : t(`link_${kind}`)}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-border-default text-text-secondary transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
                  >
                    <Icon className="size-4" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </header>
  );
}
