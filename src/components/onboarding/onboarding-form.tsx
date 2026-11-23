"use client";

import { ArrowRight, ImageUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { checkUsername, completeOnboarding, type OnboardingState, type UsernameStatus } from "@/app/(auth)/boas-vindas/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TagToggle } from "@/components/ui/tag-chip";
import { TextField } from "@/components/ui/text-field";
import { AVATAR_MAX_BYTES, MIN_TAGS } from "@/lib/auth/onboarding-rules";
import { normalizeUsername } from "@/lib/auth/username";

type Props = {
  initialName: string;
  initialUsername: string;
  avatarUrl: string | null;
  tags: { slug: string; name: string }[];
};

export function OnboardingForm({ initialName, initialUsername, avatarUrl, tags }: Props) {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [status, setStatus] = useState<{ for: string; value: UsernameStatus | "checking" } | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Confere o @ 400 ms depois da última tecla.
  useEffect(() => {
    const value = normalizeUsername(username);
    if (!value) return;
    let alive = true;
    const id = setTimeout(async () => {
      setStatus({ for: value, value: "checking" });
      const result = await checkUsername(value);
      if (alive) setStatus({ for: value, value: result });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [username]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const current = normalizeUsername(username);
  const live = status && status.for === current ? status.value : null;
  const serverError = state.errors?.username;
  const usernameError =
    serverError && serverError !== "taken" ? t(serverError) : serverError === "taken" || live === "taken" ? t("taken", { username: current }) : live && live !== "available" && live !== "checking" ? t(live) : undefined;
  const usernameHelp = live === "available" ? t("available", { username: current }) : live === "checking" ? t("checking") : t("usernameHelp");

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const bad = file.size > AVATAR_MAX_BYTES || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type);
    setPhotoError(bad);
    if (bad) {
      e.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div className="flex items-center gap-4">
        <Avatar name={name || current || "?"} src={preview ?? avatarUrl} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-semibold text-text-primary">{avatarUrl && !preview ? t("photoFromGithub") : t("photoTitle")}</p>
          <p className={`text-xs ${photoError || state.errors?.avatar ? "text-status-danger-text" : "text-text-muted"}`} role={photoError ? "alert" : undefined}>
            {photoError || state.errors?.avatar ? t("photoTooBig") : t("photoHelp")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          <ImageUp className="size-4" aria-hidden="true" />
          {t("photoChange")}
        </Button>
        <input ref={fileRef} type="file" name="avatar" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} aria-label={t("photoChange")} onChange={onPhoto} />
      </div>

      <TextField
        label={t("nameLabel")}
        name="displayName"
        autoComplete="name"
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={state.errors?.displayName ? t("nameRequired") : undefined}
      />

      <TextField
        label={t("usernameLabel")}
        name="username"
        prefix="@"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={31}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        help={usernameHelp}
        helpTone={live === "available" ? "success" : "muted"}
        error={usernameError}
      />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold text-text-secondary">{t("tagsTitle")}</legend>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagToggle
              key={tag.slug}
              name={tag.slug}
              value={tag.slug}
              checked={chosen.includes(tag.slug)}
              onChange={(e) => setChosen((c) => (e.target.checked ? [...c, tag.slug] : c.filter((s) => s !== tag.slug)))}
            />
          ))}
        </div>
        {chosen.map((slug) => (
          <input key={slug} type="hidden" name="tags" value={slug} />
        ))}
        <p className={`text-xs ${state.errors?.tags ? "text-status-danger-text" : "text-text-muted"}`} aria-live="polite">
          {state.errors?.tags ? t("tagsMin") : t("tagsHelp")} · {t("tagsCount", { count: chosen.length })}
        </p>
      </fieldset>

      {state.errors?.form ? (
        <p role="alert" className="text-sm text-status-danger-text">
          {t("errorUnknown")}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending || chosen.length < MIN_TAGS} className="w-full sm:w-auto">
          {pending ? t("saving") : t("submit")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
