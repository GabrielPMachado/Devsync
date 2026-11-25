"use client";

import { Info, LoaderCircle, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import type { UpdateResult } from "@/app/(app)/projetos/actions";
import { buttonClasses } from "@/components/ui/button";
import { TagToggle } from "@/components/ui/tag-chip";
import { TagGroups } from "@/components/ui/tag-groups";
import { TextField } from "@/components/ui/text-field";
import { TAGS_MAX, validateProject, type ProjectErrors, type ProjectInput } from "@/lib/projects/rules";

export type EditableProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  repoUrl: string | null;
  siteUrl: string | null;
};

type Errors = ProjectErrors & { form?: string };

function isRedirect(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;");
}

/** Editar textos, tags e links de um projeto. Mesmos campos e limites de publicar. */
export function EditProjectForm({
  project,
  tags,
  save,
}: {
  project: EditableProject;
  tags: { slug: string; name: string }[];
  save: (projectId: string, input: ProjectInput) => Promise<UpdateResult>;
}) {
  const t = useTranslations("Publish");
  const e = useTranslations("EditProject");
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [chosen, setChosen] = useState<string[]>(project.tags);
  const [repoUrl, setRepoUrl] = useState(project.repoUrl ?? "");
  const [siteUrl, setSiteUrl] = useState(project.siteUrl ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const descId = useId();

  const toggleTag = (slug: string) => setChosen((c) => (c.includes(slug) ? c.filter((s) => s !== slug) : c.length >= TAGS_MAX ? c : [...c, slug]));

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const input = { title, description, tags: chosen, repoUrl, siteUrl };
    const check = validateProject(input);
    if (!check.ok) return setErrors(check.errors);
    setErrors({});
    setBusy(true);
    try {
      const result = await save(project.id, input);
      // Deu certo: a ação redireciona para a página do projeto e não volta aqui.
      setBusy(false);
      if (result.error === "invalid") setErrors(result.errors);
      else setErrors({ form: result.error === "notFound" ? e("notFound") : e("unknown") });
    } catch (err) {
      if (isRedirect(err)) return;
      setBusy(false);
      setErrors({ form: e("unknown") });
    }
  }

  const tagError = errors.tags === "min" ? t("tagsMin") : errors.tags === "max" ? t("tagsMax") : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-xl border border-border-default bg-bg-surface p-5 md:p-6">
        <h2 className="font-display text-base font-bold text-text-primary">{t("aboutStep")}</h2>
        <TextField label={t("titleLabel")} value={title} onChange={(ev) => setTitle(ev.target.value)} maxLength={120} help={t("titleHelp")} error={errors.title ? t("titleError") : undefined} />
        <div className="flex flex-col gap-2">
          <label htmlFor={descId} className="text-sm font-semibold text-text-secondary">
            {t("descriptionLabel")}
          </label>
          <textarea
            id={descId}
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
            rows={9}
            placeholder={t("descriptionPlaceholder")}
            className="rounded-md border border-border-default bg-bg-base px-3 py-2.5 font-mono text-sm text-text-primary placeholder:font-sans placeholder:text-text-subtle focus:border-border-focus focus:outline-none"
          />
          <p className={`text-xs ${errors.description ? "text-status-danger-text" : "text-text-muted"}`}>{errors.description ? t("descriptionError") : t("descriptionHelp")}</p>
        </div>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-semibold text-text-secondary">{t("tagsLabel")}</legend>
          <div className="max-h-72 overflow-y-auto pr-1">
            <TagGroups tags={tags} renderTag={(tag) => <TagToggle key={tag.slug} name={tag.slug} checked={chosen.includes(tag.slug)} onChange={() => toggleTag(tag.slug)} />} />
          </div>
          <p className={`text-xs ${tagError ? "text-status-danger-text" : "text-text-muted"}`} aria-live="polite">
            {tagError ?? t("tagsHelp")}
          </p>
        </fieldset>
      </section>

      <section className="flex flex-col gap-5 rounded-xl border border-border-default bg-bg-surface p-5 md:p-6">
        <div>
          <h2 className="font-display text-base font-bold text-text-primary">{t("linksStep")}</h2>
          <p className="text-xs text-text-muted">{t("linksStepHelp")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label={t("repoLabel")} type="url" value={repoUrl} onChange={(ev) => setRepoUrl(ev.target.value)} placeholder="https://github.com/…" error={errors.repoUrl ? t("httpsError") : undefined} />
          <TextField label={t("siteLabel")} type="url" value={siteUrl} onChange={(ev) => setSiteUrl(ev.target.value)} placeholder="https://" error={errors.siteUrl ? t("httpsError") : undefined} />
        </div>
      </section>

      <p className="flex gap-2 text-xs text-text-muted">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        {e("demoNote")}
      </p>

      {errors.form ? (
        <p role="alert" className="rounded-md border border-status-danger/50 bg-status-danger-soft px-4 py-3 text-sm text-status-danger-text">
          {errors.form}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Link href={`/projetos/${project.slug}`} className={`${buttonClasses({ variant: "ghost" })} justify-center`}>
          {t("cancel")}
        </Link>
        <span className="hidden flex-1 sm:block" />
        <button type="submit" className={`${buttonClasses()} justify-center`} disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {busy ? e("submitting") : e("submit")}
        </button>
      </div>
    </form>
  );
}
