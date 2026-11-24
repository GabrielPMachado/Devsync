"use client";

import { CircleCheck, Clock, Info, Link2, LoaderCircle, Package, Send, Shield, TriangleAlert, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { TagToggle } from "@/components/ui/tag-chip";
import { TagGroups } from "@/components/ui/tag-groups";
import { TextField } from "@/components/ui/text-field";
import { GithubIcon } from "@/components/icons/github";
import { GithubError, type GithubRepo } from "@/lib/projects/github";
import type { SiteSource } from "@/lib/projects/github-demo";
import { GithubImport, type GithubServices, type ImportExtra } from "./github-import";
import type { PublishResult } from "@/app/(app)/projetos/actions";
import { DemoServiceError, waitForDemo, type DemoRow, type DemoServiceOptions, type EmbedResult } from "@/lib/demos/client";
import { EMBED_BLOCKED, reasonKey } from "@/lib/demos/reasons";
import { ZIP_MAX_BYTES } from "@/lib/demos/url";
import type { ImportDraft } from "@/lib/projects/github";
import { TAGS_MAX, validateProject, type ProjectErrors, type ProjectInput } from "@/lib/projects/rules";

/** Tudo que o formulário chama de fora. Trocável nos testes. */
export type PublishServices = {
  base: URL | null;
  token: () => Promise<string | null>;
  createUpload: (o: DemoServiceOptions) => Promise<{ demoId: string; uploadUrl: string }>;
  putZip: (uploadUrl: string, file: Blob) => Promise<void>;
  completeUpload: (o: DemoServiceOptions, demoId: string) => Promise<void>;
  embedCheck: (o: DemoServiceOptions, url: string) => Promise<EmbedResult>;
  verifyDemo: (o: DemoServiceOptions, demoId: string) => Promise<EmbedResult>;
  readDemo: (demoId: string) => Promise<DemoRow | null>;
  createLinkDemo: (url: string) => Promise<string>;
  publish: (input: ProjectInput & { demoId: string }) => Promise<PublishResult>;
  /** Importar do GitHub (opcional: sem isso o painel não aparece). */
  github?: GithubServices;
  sleep?: (ms: number) => Promise<void>;
  /** Tempo máximo esperando a validação do zip (padrão: 90 s). */
  timeoutMs?: number;
};

type Mode = "upload" | "link";
type Phase = "idle" | "fetching" | "uploading" | "validating" | "checkingLink" | "publishing";
type Errors = ProjectErrors & { zip?: string; link?: string; linkBlocked?: boolean; form?: string };

function isRedirect(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;");
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function PublishForm({ tags, services }: { tags: { slug: string; name: string }[]; services: PublishServices }) {
  const t = useTranslations("Publish");
  const reasons = useTranslations("DemoReasons");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<Errors>({});
  // Demo já criada numa tentativa anterior: tentar de novo reaproveita, sem gastar outro envio do dia.
  const [created, setCreated] = useState<{ demoId: string; file?: File; url?: string } | null>(null);
  const descId = useId();
  const zipId = useId();
  const busy = phase !== "idle";

  const toggleTag = (slug: string) => setChosen((c) => (c.includes(slug) ? c.filter((s) => s !== slug) : c.length >= TAGS_MAX ? c : [...c, slug]));

  // Demo que veio da última importação: reimportar um repo sem site não deve herdá-la.
  const importedLink = useRef<string | null>(null);

  // Arquivos do repositório que viram a demo no envio (quando não há site publicado).
  const [githubSite, setGithubSite] = useState<{ repo: GithubRepo; source: SiteSource } | null>(null);
  const [siteNote, setSiteNote] = useState<"needs_build" | "none" | "too_big" | null>(null);
  const g = useTranslations("GithubImport");

  function applyImport(d: ImportDraft, extra?: ImportExtra) {
    const site = extra?.site ?? null;
    setGithubSite(site?.kind === "found" ? { repo: extra!.repo, source: site.source } : null);
    setSiteNote(site && site.kind !== "found" ? site.kind : null);
    if (site?.kind === "found") {
      setMode("upload");
      setFile(null);
    }
    setTitle(d.title);
    setDescription(d.description);
    setChosen(d.tags);
    setRepoUrl(d.repoUrl);
    setSiteUrl(d.siteUrl);
    if (d.demoLink) {
      setMode("link");
      setLink(d.demoLink);
    } else if (importedLink.current && link === importedLink.current) setLink("");
    importedLink.current = d.demoLink;
    setErrors({});
  }

  async function finish(input: ProjectInput, demoId: string) {
    setPhase("publishing");
    const result = await services.publish({ ...input, demoId });
    // Deu certo: a ação redireciona para a página do projeto e não volta aqui.
    setPhase("idle");
    if (result.error === "invalid") setErrors(result.errors);
    else setErrors({ form: result.error === "demo" ? t("demoNotReady") : t("unknown") });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const check = validateProject({ title, description, tags: chosen, repoUrl, siteUrl });
    const next: Errors = check.ok ? {} : { ...check.errors };
    if (mode === "upload") {
      if (!file && !githubSite) next.zip = t("zipRequired");
      else if (file && file.size > ZIP_MAX_BYTES) next.zip = reasons("too_large");
    } else if (!/^https:\/\/\S+$/.test(link.trim())) next.link = t("linkRequired");
    setErrors(next);
    if (!check.ok || Object.keys(next).length > 0) return;

    if (!services.base) return setErrors({ form: t("notConfigured") });
    const token = await services.token();
    if (!token) return setErrors({ form: t("sessionExpired") });
    const o: DemoServiceOptions = { base: services.base, token };

    try {
      let zip = file;
      if (mode === "upload" && !zip && githubSite && services.github) {
        // Monta o .zip com os arquivos do repositório; depois segue como um zip escolhido.
        setPhase("fetching");
        zip = await services.github.buildDemoZip(githubSite.repo, githubSite.source);
        if (zip.size > ZIP_MAX_BYTES) {
          // Volta para o seletor de .zip, onde o erro aparece.
          setGithubSite(null);
          setPhase("idle");
          return setErrors({ zip: reasons("too_large") });
        }
        setFile(zip);
        setGithubSite(null);
      }
      if (mode === "upload" && zip) {
        let demoId = created?.file === zip ? created.demoId : null;
        if (!demoId) {
          setPhase("uploading");
          const upload = await services.createUpload(o);
          await services.putZip(upload.uploadUrl, zip);
          await services.completeUpload(o, upload.demoId);
          demoId = upload.demoId;
          setCreated({ demoId, file: zip });
        }
        setPhase("validating");
        const id = demoId;
        const result = await waitForDemo(() => services.readDemo(id), { sleep: services.sleep, timeoutMs: services.timeoutMs });
        if (result.status === "timeout") {
          setPhase("idle");
          return setErrors({ form: t("timeout") });
        }
        if (result.status === "unavailable") {
          setCreated(null);
          setPhase("idle");
          return setErrors({ zip: reasons(reasonKey(result.reason)) });
        }
        await finish(check.value, id);
      } else {
        setPhase("checkingLink");
        const url = link.trim();
        let demoId = created?.url === url ? created.demoId : null;
        if (!demoId) {
          const pre = await services.embedCheck(o, url);
          if (!pre.embeddable) return linkRejected(pre.reason);
          try {
            demoId = await services.createLinkDemo(url);
          } catch (e) {
            // Domínio na lista de bloqueio da moderação (gatilho no banco).
            if (e instanceof Error && (e.message === "blocked_domain" || e.message === "invalid_url")) return linkRejected(e.message);
            throw e;
          }
          setCreated({ demoId, url });
        }
        const verified = await services.verifyDemo(o, demoId);
        if (!verified.embeddable) return linkRejected(verified.reason);
        await finish(check.value, demoId);
      }
    } catch (err) {
      // Publicou: a ação redireciona, o Next já está navegando e rejeita a promessa com o
      // redirecionamento. Não é erro: o botão segue em "Publicando…" até a página trocar.
      if (isRedirect(err)) return;
      setPhase("idle");
      setErrors({ form: err instanceof DemoServiceError ? err.message : err instanceof GithubError ? g("network") : t("unknown") });
    }
  }

  function linkRejected(reason: string | undefined) {
    setPhase("idle");
    setErrors(EMBED_BLOCKED.has(reason ?? "") ? { link: reasons(reasonKey(reason)), linkBlocked: true } : { link: reasons(reasonKey(reason)) });
  }

  const tagError = errors.tags === "min" ? t("tagsMin") : errors.tags === "max" ? t("tagsMax") : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {services.github ? <GithubImport services={services.github} tags={tags.map((tag) => tag.slug)} onImport={applyImport} /> : null}
      <Step n={1} title={t("aboutStep")}>
        <TextField label={t("titleLabel")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} help={t("titleHelp")} error={errors.title ? t("titleError") : undefined} />
        <div className="flex flex-col gap-2">
          <label htmlFor={descId} className="text-sm font-semibold text-text-secondary">
            {t("descriptionLabel")}
          </label>
          <textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={7}
            placeholder={t("descriptionPlaceholder")}
            className="rounded-md border border-border-default bg-bg-base px-3 py-2.5 font-mono text-sm text-text-primary placeholder:font-sans placeholder:text-text-subtle focus:border-border-focus focus:outline-none"
          />
          <p className={`text-xs ${errors.description ? "text-status-danger-text" : "text-text-muted"}`}>{errors.description ? t("descriptionError") : t("descriptionHelp")}</p>
        </div>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-semibold text-text-secondary">{t("tagsLabel")}</legend>
          <div className="max-h-72 overflow-y-auto pr-1">
            <TagGroups
              tags={tags}
              renderTag={(tag) => <TagToggle key={tag.slug} name={tag.slug} checked={chosen.includes(tag.slug)} onChange={() => toggleTag(tag.slug)} />}
            />
          </div>
          <p className={`text-xs ${tagError ? "text-status-danger-text" : "text-text-muted"}`} aria-live="polite">
            {tagError ?? t("tagsHelp")}
          </p>
        </fieldset>
      </Step>

      <Step n={2} title={t("demoStep")} help={t("demoStepHelp")}>
        <fieldset className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <legend className="sr-only">{t("demoKind")}</legend>
          <Option icon={<Upload className="size-[18px]" aria-hidden="true" />} title={t("uploadOption")} text={t("uploadOptionHelp")} checked={mode === "upload"} onChange={() => setMode("upload")} />
          <Option icon={<Link2 className="size-[18px]" aria-hidden="true" />} title={t("linkOption")} text={t("linkOptionHelp")} checked={mode === "link"} onChange={() => setMode("link")} />
        </fieldset>
        {siteNote ? (
          <p role="status" className="flex gap-2 rounded-md border border-status-warning/40 bg-status-warning-soft px-3 py-2 text-sm text-text-secondary">
            <Info className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden="true" />
            {g(`site_${siteNote}`)}
          </p>
        ) : null}

        {mode === "upload" ? (
          phase === "fetching" || phase === "uploading" || phase === "validating" || (phase === "publishing" && file) ? (
            <div className="flex flex-col gap-3.5 rounded-lg border border-border-default bg-bg-base p-4" aria-live="polite">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-brand-accent-soft p-2.5 text-brand-accent">
                  <Package className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{file?.name ?? (githubSite ? `${githubSite.repo.name}.zip` : null)}</p>
                  <p className="text-xs text-text-muted">{file ? formatSize(file.size) : null}</p>
                </div>
                <span className="rounded-full border border-brand-accent/40 bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">{phase === "fetching" ? g("fetchingBadge") : t("validating")}</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {phase === "fetching" ? <Progress done={false} active={phase === "fetching"} text={g("fetching")} /> : null}
                <Progress done={phase !== "fetching" && phase !== "uploading"} active={phase === "uploading"} text={t("stepSent")} />
                <Progress done={phase === "publishing"} active={phase === "validating"} text={t("stepChecking")} />
                <Progress done={false} active={phase === "publishing"} text={t("stepPublishing")} />
              </ul>
            </div>
          ) : githubSite && !file ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-base p-4">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-bg-muted p-2.5 text-text-primary">
                  <GithubIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{g("fromGithub")}</p>
                  <p className="truncate text-xs text-text-muted">
                    {g("fromGithubInfo", {
                      repo: githubSite.repo.fullName,
                      where:
                        githubSite.source.ref === "gh-pages"
                          ? g("ghPages")
                          : githubSite.source.folder
                            ? g("folder", { folder: githubSite.source.folder })
                            : g("rootFolder"),
                      count: githubSite.source.files.length,
                    })}
                  </p>
                </div>
              </div>
              <p className="text-xs text-text-muted">{g("fromGithubHelp")}</p>
              <button type="button" onClick={() => setGithubSite(null)} className={`${buttonClasses({ variant: "ghost", size: "sm" })} self-start`}>
                {g("useZipInstead")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label
                htmlFor={zipId}
                className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-lg border border-dashed bg-bg-base p-8 text-center ${errors.zip ? "border-status-danger" : "border-border-strong"} hover:border-border-focus`}
              >
                <span className="rounded-full bg-brand-accent-soft p-3 text-brand-accent">
                  <Upload className="size-6" aria-hidden="true" />
                </span>
                <span className="sr-only">{t("zipLabel")}</span>
                {file ? (
                  <span className="text-sm text-text-secondary">
                    <strong className="text-text-primary">{file.name}</strong> · {t("zipChosen", { size: formatSize(file.size) })}
                  </span>
                ) : (
                  <span className="text-sm text-text-secondary">{t.rich("zipDrop", { link: (c) => <span className="text-text-link">{c}</span> })}</span>
                )}
                <span className="text-xs text-text-muted">{t("zipLimits")}</span>
              </label>
              <input
                id={zipId}
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                aria-label={t("zipLabel")}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setSiteNote(null);
                  setErrors((er) => ({ ...er, zip: undefined }));
                }}
              />
              {errors.zip ? (
                <p role="alert" className="text-xs text-status-danger-text">
                  {errors.zip}
                </p>
              ) : null}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <TextField
              label={t("linkLabel")}
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={t("linkPlaceholder")}
              error={errors.link && !errors.linkBlocked ? errors.link : undefined}
              help={errors.linkBlocked ? errors.link : phase === "checkingLink" ? t("stepLinkChecking") : undefined}
            />
            {errors.linkBlocked ? (
              <div role="alert" className="flex flex-col gap-3 rounded-lg border border-status-danger/50 bg-status-danger-soft p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-status-danger-text">
                  <TriangleAlert className="size-4" aria-hidden="true" />
                  {t("linkBlockedTitle")}
                </p>
                <p className="text-sm text-text-secondary">{t("linkBlockedText")}</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border-default bg-bg-base p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <Shield className="size-4 text-icon-muted" aria-hidden="true" />
                      {t("allowOnSite")}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">{t("allowOnSiteHelp")}</p>
                  </div>
                  <button type="button" onClick={() => setMode("upload")} className="rounded-lg border border-border-default bg-bg-base p-4 text-left hover:border-border-focus">
                    <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <Upload className="size-4 text-icon-muted" aria-hidden="true" />
                      {t("sendFiles")}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">{t("sendFilesHelp")}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Step>

      <Step n={3} title={t("linksStep")} help={t("linksStepHelp")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label={t("repoLabel")} type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/…" error={errors.repoUrl ? t("httpsError") : undefined} />
          <TextField label={t("siteLabel")} type="url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://" error={errors.siteUrl ? t("httpsError") : undefined} />
        </div>
      </Step>

      {errors.form ? (
        <p role="alert" className="rounded-md border border-status-danger/50 bg-status-danger-soft px-4 py-3 text-sm text-status-danger-text">
          {errors.form}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Link href="/projetos" className={buttonClasses({ variant: "ghost" })}>
          {t("cancel")}
        </Link>
        <span className="flex-1" />
        <button type="submit" className={buttonClasses()} disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {busy ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}

function Step({ n, title, help, children }: { n: number; title: string; help?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border-default bg-bg-surface p-5 md:p-6">
      <header className="flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-brand-primary bg-brand-primary-soft text-xs font-semibold text-brand-accent">{n}</span>
        <div>
          <h2 className="font-display text-base font-bold text-text-primary">{title}</h2>
          {help ? <p className="text-xs text-text-muted">{help}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function Option({ icon, title, text, checked, onChange }: { icon: ReactNode; title: string; text: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-4 has-focus-visible:outline-2 has-focus-visible:outline-border-focus ${
        checked ? "border-brand-primary bg-brand-primary-soft" : "border-border-default bg-bg-base hover:border-border-strong"
      }`}
    >
      <input type="radio" name="demoKind" className="sr-only" checked={checked} onChange={onChange} />
      <span className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border ${checked ? "border-brand-accent" : "border-border-strong"}`} aria-hidden="true">
        {checked ? <span className="size-2 rounded-full bg-brand-accent" /> : null}
      </span>
      <span className="flex flex-col gap-1">
        <span className={`flex items-center gap-2 text-sm font-semibold text-text-primary ${checked ? "[&_svg]:text-brand-accent" : "[&_svg]:text-icon-muted"}`}>
          {icon}
          {title}
        </span>
        <span className="text-xs text-text-muted">{text}</span>
      </span>
    </label>
  );
}

function Progress({ done, active, text }: { done: boolean; active: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-2.5 ${done || active ? "text-text-secondary" : "text-text-muted"}`}>
      {done ? (
        <CircleCheck className="size-4 text-status-success" aria-hidden="true" />
      ) : active ? (
        <LoaderCircle className="size-4 animate-spin text-brand-accent" aria-hidden="true" />
      ) : (
        <Clock className="size-4 text-icon-muted" aria-hidden="true" />
      )}
      {text}
    </li>
  );
}

/** Aviso lateral da tela de publicar. */
export function OverlayNotice() {
  const t = useTranslations("Publish");
  return (
    <aside className="flex gap-3 rounded-xl border border-brand-accent/30 bg-brand-accent-soft p-4">
      <Info className="mt-0.5 size-4 shrink-0 text-brand-accent" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-text-primary">{t("overlayNoticeTitle")}</p>
        <p className="text-xs text-text-secondary">{t("overlayNoticeText")}</p>
      </div>
    </aside>
  );
}
