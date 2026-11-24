"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { ACCENT_COLORS, isAccent, isBannerPreset, isStatus } from "@/lib/social/profile-style";
import { BANNER_BACKGROUNDS, FRAME_RINGS } from "./preview-style";

export type PreviewData = {
  displayName: string;
  username: string;
  headline: string;
  location: string;
  status: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bannerPreset: string;
  avatarFrame: string;
  accent: string;
  links: { key: string; label: string }[];
};

/** Prévia ao vivo do cabeçalho do perfil. */
/** No celular fica compacta (banner baixo, sem bio e links); completa a partir de lg. */
export function ProfilePreview({ data }: { data: PreviewData }) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const name = data.displayName.trim() || data.username;
  const accent = ACCENT_COLORS[isAccent(data.accent) ? data.accent : "azul"];
  const banner = data.bannerUrl
    ? `center / cover no-repeat url("${data.bannerUrl.replace(/"/g, "%22")}")`
    : BANNER_BACKGROUNDS[isBannerPreset(data.bannerPreset) ? data.bannerPreset : "padrao"];

  return (
    <section aria-label={t("preview")} className="overflow-hidden rounded-xl border border-border-default bg-bg-surface">
      <div aria-hidden="true" className="h-16 lg:h-24" style={{ background: banner }} />
      <div className="flex flex-col gap-2 px-4 pb-4">
        <span className={`-mt-8 inline-flex self-start rounded-full border-4 border-bg-surface ${FRAME_RINGS[data.avatarFrame] ?? ""}`}>
          <Avatar name={name} src={data.avatarUrl} size="lg" />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-display text-lg font-bold text-text-primary">{name}</p>
          <p className="truncate font-mono text-xs text-text-muted">@{data.username}</p>
        </div>
        {data.headline.trim() ? <p className="text-sm text-text-secondary">{data.headline.trim()}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          {isStatus(data.status) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-text-primary" style={{ borderColor: accent }}>
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: accent }} />
              {style(`status_${data.status}`)}
            </span>
          ) : null}
          {data.location.trim() ? (
            <span className="inline-flex items-center gap-1 text-text-muted">
              <MapPin className="size-3.5" aria-hidden="true" />
              {data.location.trim()}
            </span>
          ) : null}
        </div>
        {data.bio.trim() ? <p className="hidden line-clamp-3 text-sm lg:block text-text-secondary">{data.bio.trim()}</p> : null}
        {data.links.length ? (
          <ul className="hidden flex-wrap gap-2 lg:flex">
            {data.links.map((l) => (
              <li key={l.key} className="rounded-sm border border-border-default px-2 py-0.5 text-xs" style={{ color: accent }}>
                {l.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
