"use client";

import { CircleCheck, LoaderCircle, Search, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { GithubIcon } from "@/components/icons/github";
import { buttonClasses } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { githubUser } from "@/lib/social/profile-rules";
import type { SiteLookup, SiteSource } from "@/lib/projects/github-demo";
import { GithubError, importDraft, type GithubRepo, type ImportDraft, type RepoDetails } from "@/lib/projects/github";

export type GithubServices = {
  /** Usuário do GitHub da pessoa (perfil ou login com GitHub), se houver. */
  user: string | null;
  listRepos: (user: string) => Promise<GithubRepo[]>;
  repoDetails: (repo: GithubRepo) => Promise<RepoDetails>;
  findSiteSource: (repo: GithubRepo) => Promise<SiteLookup>;
  buildDemoZip: (repo: GithubRepo, source: SiteSource) => Promise<File>;
};

/** O que acompanha o rascunho: o repo e, sem site publicado, onde estão os arquivos do site. */
export type ImportExtra = { repo: GithubRepo; site: SiteLookup | null };

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; error: GithubError | null }
  | { kind: "list"; user: string; repos: GithubRepo[] };

/** Painel "Importar do GitHub" do formulário de publicar. */
export function GithubImport({ services, tags, onImport }: { services: GithubServices; tags: string[]; onImport: (draft: ImportDraft, extra: ImportExtra) => void }) {
  const t = useTranslations("GithubImport");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(services.user ?? "");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [filter, setFilter] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  // Erro ao ler o repositório escolhido: a lista continua na tela.
  const [pickError, setPickError] = useState<GithubError | null | undefined>(undefined);
  const filterId = useId();
  // Só a última busca vale: uma resposta antiga que chega depois é ignorada.
  const request = useRef(0);

  async function load(name: string) {
    const u = name.trim().replace(/^@/, "");
    if (!u) return;
    const id = ++request.current;
    setState({ kind: "loading" });
    setFilter("");
    setPickError(undefined);
    try {
      const repos = await services.listRepos(u);
      if (id === request.current) setState({ kind: "list", user: githubUser(u) ?? u, repos });
    } catch (e) {
      if (id === request.current) setState({ kind: "error", error: e instanceof GithubError ? e : null });
    }
  }

  async function pick(repo: GithubRepo) {
    setPicking(repo.fullName);
    setPickError(undefined);
    try {
      const details = await services.repoDetails(repo);
      const draft = importDraft(repo, details, tags);
      // Sem site publicado: os arquivos do repositório podem virar a demo.
      // Se a busca pelos arquivos falhar, a importação segue sem eles.
      const site = draft.demoLink ? null : await services.findSiteSource(repo).catch(() => null);
      onImport(draft, { repo, site });
      setImported(repo.fullName);
      setOpen(false);
    } catch (e) {
      setPickError(e instanceof GithubError ? e : null);
    } finally {
      setPicking(null);
    }
  }

  function errorText(error: GithubError | null) {
    if (error?.code === "not_found") return t("not_found");
    if (error?.code === "rate_limit") return error.resetAt ? t("rate_limit", { time: format.dateTime(error.resetAt, { hour: "2-digit", minute: "2-digit" }) }) : t("rate_limit_later");
    return t("network");
  }

  const shown = state.kind === "list" ? state.repos.filter((r) => r.name.toLowerCase().includes(filter.trim().toLowerCase())) : [];

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-bg-muted p-2.5 text-text-primary">
          <GithubIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-bold text-text-primary">{t("title")}</h2>
          <p className="text-xs text-text-muted">{t("text")}</p>
        </div>
        {open ? (
          <button type="button" onClick={() => setOpen(false)} className={buttonClasses({ variant: "ghost", size: "sm" })} aria-label={t("close")}>
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
            onClick={() => {
              setOpen(true);
              setImported(null);
              if (state.kind === "idle" && services.user) void load(services.user);
            }}
          >
            {t("open")}
          </button>
        )}
      </div>

      {imported && !open ? (
        <p role="status" className="flex items-center gap-2 text-sm text-text-secondary">
          <CircleCheck className="size-4 text-status-success" aria-hidden="true" />
          {t("imported", { repo: imported })}
        </p>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <TextField
              className="flex-1"
              label={t("userLabel")}
              prefix="@"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void load(user);
                }
              }}
              autoComplete="off"
            />
            <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => void load(user)} disabled={state.kind === "loading"}>
              {t("search")}
            </button>
          </div>

          {state.kind === "loading" ? (
            <p className="flex items-center gap-2 text-sm text-text-muted" aria-live="polite">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {t("loading")}
            </p>
          ) : null}

          {state.kind === "error" ? (
            <p role="alert" className="rounded-md border border-status-danger/50 bg-status-danger-soft px-3 py-2 text-sm text-status-danger-text">
              {errorText(state.error)}
            </p>
          ) : null}

          {state.kind === "list" ? (
            state.repos.length === 0 ? (
              <p className="text-sm text-text-muted">{t("empty")}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-md border border-border-default bg-bg-base px-3 focus-within:border-border-focus">
                  <Search className="size-4 text-icon-muted" aria-hidden="true" />
                  <label htmlFor={filterId} className="sr-only">
                    {t("filterLabel")}
                  </label>
                  <input
                    id={filterId}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t("filterLabel")}
                    className="h-10 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-subtle focus:outline-none"
                  />
                </div>
                <ul aria-label={t("listLabel", { user: state.user })} className="flex max-h-80 flex-col divide-y divide-border-default overflow-y-auto rounded-lg border border-border-default">
                  {shown.map((r) => (
                    <li key={r.fullName} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-semibold text-text-primary">{r.name}</p>
                        {r.description ? <p className="truncate text-xs text-text-muted">{r.description}</p> : null}
                        {r.language ? <p className="mt-0.5 text-xs text-text-subtle">{r.language}</p> : null}
                      </div>
                      <button
                        type="button"
                        className={buttonClasses({ variant: "secondary", size: "sm" })}
                        onClick={() => void pick(r)}
                        disabled={picking !== null}
                        aria-label={t("use", { name: r.name })}
                      >
                        {picking === r.fullName ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                        {t("useShort")}
                      </button>
                    </li>
                  ))}
                </ul>
                {shown.length === 0 ? <p className="text-sm text-text-muted">{t("noMatch")}</p> : null}
                {pickError !== undefined ? (
                  <p role="alert" className="rounded-md border border-status-danger/50 bg-status-danger-soft px-3 py-2 text-sm text-status-danger-text">
                    {errorText(pickError)}
                  </p>
                ) : null}
              </div>
            )
          ) : null}

          <p className="text-xs text-text-subtle">{t("privateNote")}</p>
        </div>
      ) : null}
    </section>
  );
}
