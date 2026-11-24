"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveProfile, type SaveProfileState } from "@/app/(app)/configuracoes/actions";
import { Button, buttonClasses } from "@/components/ui/button";
import { TagToggle } from "@/components/ui/tag-chip";
import { TagGroups } from "@/components/ui/tag-groups";
import { TextField } from "@/components/ui/text-field";
import { BIO_MAX, NAME_MAX, PROFILE_TAGS_MAX, type ProfileInput } from "@/lib/social/profile-rules";

type Props = { initial: ProfileInput; username: string; tags: { slug: string; name: string }[] };

/** Editar perfil: nome, bio, links e tecnologias. */
export function ProfileForm({ initial, username, tags }: Props) {
  const t = useTranslations("Settings");
  const [state, action, pending] = useActionState<SaveProfileState, FormData>(saveProfile, {});
  const values = state.values ?? initial;
  const [chosen, setChosen] = useState<string[]>(initial.tags);
  const [bio, setBio] = useState(initial.bio);
  const e = state.errors ?? {};
  // As tecnologias atuais primeiro, depois o resto.
  const ordered = [...tags].sort((a, b) => Number(initial.tags.includes(b.slug)) - Number(initial.tags.includes(a.slug)));

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <TextField label={t("name")} name="displayName" autoComplete="name" maxLength={NAME_MAX} defaultValue={values.displayName} error={e.displayName ? t("nameError") : undefined} />
      <div className="flex flex-col gap-2">
        <label htmlFor="bio" className="text-sm font-semibold text-text-secondary">
          {t("bio")}
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={BIO_MAX}
          value={bio}
          onChange={(ev) => setBio(ev.target.value)}
          placeholder={t("bioPlaceholder")}
          aria-invalid={e.bio ? true : undefined}
          className={`rounded-md border bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-subtle focus:border-border-focus focus:outline-none ${e.bio ? "border-status-danger" : "border-border-default"}`}
        />
        <p className="text-xs text-text-muted">{t("bioCount", { count: bio.length, max: BIO_MAX })}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label={t("github")} name="github" prefix="github.com/" autoCapitalize="none" spellCheck={false} defaultValue={values.github} error={e.github ? t("githubError") : undefined} />
        <TextField label={t("site")} name="site" type="url" inputMode="url" placeholder="https://" defaultValue={values.site} error={e.site ? t("siteError") : undefined} />
      </div>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold text-text-secondary">{t("technologies")}</legend>
        <div className="max-h-72 overflow-y-auto pr-1">
          <TagGroups
            tags={ordered}
            renderTag={(tag) => (
              <TagToggle
                key={tag.slug}
                name={tag.slug}
                value={tag.slug}
                checked={chosen.includes(tag.slug)}
                onChange={(ev) => setChosen((c) => (ev.target.checked ? [...c, tag.slug] : c.filter((s) => s !== tag.slug)))}
              />
            )}
          />
        </div>
        {chosen.map((slug) => (
          <input key={slug} type="hidden" name="tags" value={slug} />
        ))}
        <p className={`text-xs ${e.tags || chosen.length > PROFILE_TAGS_MAX ? "text-status-danger-text" : "text-text-muted"}`} aria-live="polite">
          {t("technologiesHelp", { max: PROFILE_TAGS_MAX })} · {t("technologiesCount", { count: chosen.length })}
        </p>
      </fieldset>
      {state.error ? (
        <p role="alert" className="text-sm text-status-danger-text">
          {t("error")}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Link href={`/@${username}`} className={buttonClasses({ variant: "ghost" })}>
          {t("cancel")}
        </Link>
        <Button type="submit" disabled={pending || chosen.length > PROFILE_TAGS_MAX}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
