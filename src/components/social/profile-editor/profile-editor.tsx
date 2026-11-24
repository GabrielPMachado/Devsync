"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { saveProfile, type SaveProfileState } from "@/app/(app)/configuracoes/actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { TagToggle } from "@/components/ui/tag-chip";
import { TagGroups } from "@/components/ui/tag-groups";
import { TextField } from "@/components/ui/text-field";
import { BIO_MAX, HEADLINE_MAX, LOCATION_MAX, NAME_MAX, PROFILE_TAGS_MAX, type ProfileInput } from "@/lib/social/profile-rules";
import { STATUSES } from "@/lib/social/profile-style";
import { AccentPicker, BannerPicker } from "./appearance-pickers";
import { EditorSection } from "./editor-section";
import { FramePicker } from "./frame-picker";
import { ProfilePreview } from "./profile-preview";

type Props = {
  initial: ProfileInput;
  username: string;
  tags: { slug: string; name: string }[];
  avatarUrl: string | null;
  bannerUrl: string | null;
  /** Insígnias da pessoa (sem a lista, todas as bordas ficam liberadas). */
  unlockedBadges?: string[];
  /** Campos de foto e banner (envio e recorte). */
  imageFields?: { avatar?: ReactNode; banner?: ReactNode };
  /** Seção de insígnias. */
  badgesSection?: ReactNode;
};

const LINKS = [
  { key: "github", prefix: "github.com/", label: "GitHub" },
  { key: "linkedin", prefix: "linkedin.com/in/", label: "LinkedIn" },
  { key: "x", prefix: "x.com/", label: "X" },
  { key: "youtube", prefix: "youtube.com/@", label: "YouTube" },
] as const;

/** Editar perfil: aparência, sobre você, links e tecnologias, com prévia ao vivo. */
export function ProfileEditor({ initial, username, tags, avatarUrl, bannerUrl, unlockedBadges, imageFields, badgesSection }: Props) {
  const t = useTranslations("Settings");
  const style = useTranslations("ProfileStyle");
  const [state, action, pending] = useActionState<SaveProfileState, FormData>(saveProfile, {});
  const [v, setV] = useState<ProfileInput>(() => ({ ...initial, ...(state.values ?? {}) }));
  const [dirty, setDirty] = useState(false);
  const e = state.errors ?? {};
  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => {
    setV((old) => ({ ...old, [key]: value }));
    setDirty(true);
  };
  const field = (key: "displayName" | "bio" | "headline" | "location" | "status" | "github" | "linkedin" | "x" | "youtube" | "site") => ({
    name: key,
    value: v[key],
    onChange: (ev: { target: { value: string } }) => set(key, ev.target.value),
  });

  // Sair com mudanças não salvas pede confirmação do navegador.
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  // As tecnologias atuais primeiro, depois o resto.
  const [ordered] = useState(() => [...tags].sort((a, b) => Number(initial.tags.includes(b.slug)) - Number(initial.tags.includes(a.slug))));
  const appearanceError = e.bannerPreset || e.avatarFrame || e.accent || e.avatarUrl || e.bannerUrl;

  return (
    <form action={action} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <aside className="lg:sticky lg:top-20 lg:order-2">
        <ProfilePreview
          data={{
            ...v,
            username,
            avatarUrl,
            bannerUrl,
            links: [...LINKS.filter((l) => v[l.key].trim()), ...(v.site.trim() ? [{ key: "site", label: t("site") }] : [])].map(({ key, label }) => ({ key, label })),
          }}
        />
      </aside>

      <div className="flex min-w-0 flex-col gap-6 lg:order-1">
        <EditorSection id="aparencia" title={t("sectionAppearance")} help={t("sectionAppearanceHelp")}>
          {imageFields?.banner}
          <BannerPicker value={v.bannerPreset} onChange={(p) => set("bannerPreset", p)} />
          {imageFields?.avatar}
          <FramePicker name={v.displayName || username} avatarUrl={avatarUrl} value={v.avatarFrame} onChange={(f) => set("avatarFrame", f)} unlockedBadges={unlockedBadges} />
          <AccentPicker value={v.accent} onChange={(a) => set("accent", a)} />
          {appearanceError ? <p className="text-xs text-status-danger-text">{t("appearanceError")}</p> : null}
          <input type="hidden" name="bannerPreset" value={v.bannerPreset} />
          <input type="hidden" name="avatarFrame" value={v.avatarFrame} />
          <input type="hidden" name="accent" value={v.accent} />
        </EditorSection>

        <EditorSection id="sobre" title={t("sectionAbout")} help={t("sectionAboutHelp")}>
          <TextField label={t("name")} autoComplete="name" maxLength={NAME_MAX} error={e.displayName ? t("nameError") : undefined} {...field("displayName")} />
          <TextField label={t("headline")} placeholder={t("headlinePlaceholder")} maxLength={HEADLINE_MAX} error={e.headline ? t("headlineError") : undefined} {...field("headline")} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextField label={t("location")} placeholder={t("locationPlaceholder")} maxLength={LOCATION_MAX} error={e.location ? t("locationError") : undefined} {...field("location")} />
            <div className="flex flex-col gap-2">
              <label htmlFor="status" className="text-sm font-semibold text-text-secondary">
                {t("status")}
              </label>
              <select id="status" className="h-11 rounded-md border border-border-default bg-bg-base px-3 text-sm text-text-primary focus:border-border-focus focus:outline-none" {...field("status")}>
                <option value="">{t("statusNone")}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {style(`status_${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="bio" className="text-sm font-semibold text-text-secondary">
              {t("bio")}
            </label>
            <textarea
              id="bio"
              rows={4}
              maxLength={BIO_MAX}
              placeholder={t("bioPlaceholder")}
              aria-invalid={e.bio ? true : undefined}
              className={`rounded-md border bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-subtle focus:border-border-focus focus:outline-none ${e.bio ? "border-status-danger" : "border-border-default"}`}
              {...field("bio")}
            />
            <p className="text-xs text-text-muted">{t("bioCount", { count: v.bio.length, max: BIO_MAX })}</p>
          </div>
        </EditorSection>

        <EditorSection id="links" title={t("sectionLinks")} help={t("sectionLinksHelp")}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {LINKS.map((l) => (
              <TextField key={l.key} label={t(l.key)} prefix={l.prefix} autoCapitalize="none" spellCheck={false} error={e[l.key] ? t(`${l.key}Error`) : undefined} {...field(l.key)} />
            ))}
            <TextField label={t("site")} type="url" inputMode="url" placeholder="https://" error={e.site ? t("siteError") : undefined} {...field("site")} />
          </div>
        </EditorSection>

        <EditorSection id="tecnologias" title={t("sectionTechnologies")} help={t("technologiesHelp", { max: PROFILE_TAGS_MAX })}>
          <div className="max-h-72 overflow-y-auto pr-1">
            <TagGroups
              tags={ordered}
              renderTag={(tag) => (
                <TagToggle
                  key={tag.slug}
                  name={tag.slug}
                  value={tag.slug}
                  checked={v.tags.includes(tag.slug)}
                  onChange={(ev) => set("tags", ev.target.checked ? [...v.tags, tag.slug] : v.tags.filter((s) => s !== tag.slug))}
                />
              )}
            />
          </div>
          {v.tags.map((slug) => (
            <input key={slug} type="hidden" name="tags" value={slug} />
          ))}
          <p className={`text-xs ${e.tags || v.tags.length > PROFILE_TAGS_MAX ? "text-status-danger-text" : "text-text-muted"}`} aria-live="polite">
            {t("technologiesCount", { count: v.tags.length })}
          </p>
        </EditorSection>

        {badgesSection}

        {/* No celular fica acima da barra de abas; no computador, presa ao fim da tela. */}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-surface/95 px-4 py-3 backdrop-blur md:bottom-4">
          <p className="text-xs text-text-muted" aria-live="polite">
            {state.error ? <span className="text-status-danger-text">{t("error")}</span> : dirty ? t("unsaved") : t("saved")}
          </p>
          <div className="flex gap-2">
            <Link href={`/@${username}`} className={buttonClasses({ variant: "ghost" })}>
              {t("cancel")}
            </Link>
            <Button type="submit" disabled={pending || v.tags.length > PROFILE_TAGS_MAX}>
              {pending ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
