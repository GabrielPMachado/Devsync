import { githubUser } from "@/lib/social/profile-rules";
import { DESCRIPTION_MAX, TAGS_MAX, TITLE_MIN } from "./rules";

/** Importar projeto do GitHub: API pública, chamada do navegador, sem token. */

const API = "https://api.github.com";

export type GithubRepo = {
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  fork: boolean;
  pushedAt: string;
  defaultBranch: string;
};

export type RepoDetails = { readme: string | null; languages: string[] };

export type ImportDraft = { title: string; description: string; tags: string[]; repoUrl: string; siteUrl: string; demoLink: string | null };

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export type GithubErrorCode = "not_found" | "rate_limit" | "network";

export class GithubError extends Error {
  constructor(
    public code: GithubErrorCode,
    public resetAt?: Date,
  ) {
    super(code);
    this.name = "GithubError";
  }
}

const USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

async function call(url: string, fetchFn: FetchFn, accept = "application/vnd.github+json"): Promise<Response> {
  let r: Response;
  try {
    r = await fetchFn(url, { headers: { Accept: accept } });
  } catch {
    throw new GithubError("network");
  }
  if ((r.status === 403 || r.status === 429) && r.headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(r.headers.get("x-ratelimit-reset"));
    throw new GithubError("rate_limit", Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : undefined);
  }
  return r;
}

type ApiRepo = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  fork: boolean;
  pushed_at: string;
  default_branch: string;
};

/** Repositórios públicos do usuário, mais recentes primeiro, sem forks. */
export async function listRepos(user: string, fetchFn: FetchFn = fetch): Promise<GithubRepo[]> {
  // Aceita "@ana", "ana" ou o link do perfil, como na tela de configurações.
  const u = githubUser(user.trim());
  if (!u) throw new GithubError("not_found");
  const r = await call(`${API}/users/${u}/repos?per_page=100&sort=pushed&type=owner`, fetchFn);
  if (r.status === 404) throw new GithubError("not_found");
  if (!r.ok) throw new GithubError("network");
  const list = (await r.json()) as ApiRepo[];
  return list
    .filter((x) => !x.fork)
    .map((x) => ({
      name: x.name,
      fullName: x.full_name,
      description: x.description,
      htmlUrl: x.html_url,
      homepage: x.homepage,
      language: x.language,
      topics: x.topics ?? [],
      fork: x.fork,
      pushedAt: x.pushed_at,
      defaultBranch: x.default_branch,
    }));
}

/** README cru (null se não houver) e linguagens da maior para a menor. */
export async function repoDetails(repo: GithubRepo, fetchFn: FetchFn = fetch): Promise<RepoDetails> {
  const [readmeRes, langRes] = await Promise.all([
    call(`${API}/repos/${repo.fullName}/readme`, fetchFn, "application/vnd.github.raw+json"),
    call(`${API}/repos/${repo.fullName}/languages`, fetchFn),
  ]);
  const readme = readmeRes.ok ? await readmeRes.text() : null;
  const bytes = langRes.ok ? ((await langRes.json()) as Record<string, number>) : {};
  const languages = Object.entries(bytes)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  return { readme, languages };
}

const ALIASES: Record<string, string> = {
  reactjs: "react",
  "react-js": "react",
  nextjs: "react",
  "next-js": "react",
  reactnative: "react-native",
  vuejs: "vue",
  "vue-js": "vue",
  sveltekit: "svelte",
  angularjs: "angular",
  golang: "go",
  tailwind: "tailwindcss",
  "tailwind-css": "tailwindcss",
  scss: "css",
  sass: "css",
  less: "css",
  plpgsql: "sql",
  tsql: "sql",
  postgres: "postgresql",
  mongo: "mongodb",
  nodejs: "backend",
  node: "backend",
  "node-js": "backend",
  express: "backend",
  js: "javascript",
  ts: "typescript",
  py: "python",
  k8s: "kubernetes",
  "machine-learning": "ia",
  ai: "ia",
  "artificial-intelligence": "ia",
  security: "seguranca",
  testing: "testes",
  android: "mobile",
  ios: "mobile",
};

/** Tópicos e linguagens do GitHub viram assuntos da Devsync (só os que existem, até 5). */
export function mapTags(names: string[], available: string[]): string[] {
  const have = new Set(available);
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim().toLowerCase().replace(/\s+/g, "-");
    const slug = ALIASES[n] ?? n;
    if (have.has(slug) && !out.includes(slug)) out.push(slug);
    if (out.length >= TAGS_MAX) break;
  }
  return out;
}

// Blocos de código (``` ou ~~~, até o fim se não fecharem), código inline e links markdown.
const README_TOKENS = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[`~]*[ \t]*$|(?![\s\S]))|(`+)[^`][\s\S]*?\2|\]\(\s*([^)\s]+)([^)]*)\)/gm;

/**
 * Links relativos do README passam a apontar para o arquivo no GitHub.
 * Código fica intacto. Limites aceitos: links entre <> e definições de referência ([x]: a.md) não mudam.
 */
export function absolutizeReadme(md: string, repo: GithubRepo): string {
  const base = `${repo.htmlUrl}/blob/${repo.defaultBranch}/`;
  return md.replace(README_TOKENS, (all: string, _fence?: string, _tick?: string, url?: string, rest?: string) => {
    if (!url || /^([a-z][a-z0-9+.-]*:|#|\/\/|<)/i.test(url)) return all;
    const path = url.replace(/^\.\//, "").replace(/^\/+/, "");
    return `](${base}${path}${rest ?? ""})`;
  });
}

function https(url: string | null): string {
  const v = (url ?? "").trim();
  try {
    return new URL(v).protocol === "https:" ? v : "";
  } catch {
    return "";
  }
}

/** O que o formulário de publicar recebe ao escolher um repositório. */
export function importDraft(repo: GithubRepo, details: RepoDetails, available: string[]): ImportDraft {
  const readme = details.readme?.trim() ? absolutizeReadme(details.readme.trim(), repo) : "";
  const description = readme && readme.length <= DESCRIPTION_MAX ? readme : (repo.description ?? "").trim();
  const site = https(repo.homepage);
  return {
    title: repo.name.length >= TITLE_MIN ? repo.name : repo.fullName,
    description,
    tags: mapTags([...repo.topics, ...(repo.language ? [repo.language] : []), ...details.languages], available),
    repoUrl: repo.htmlUrl,
    siteUrl: site,
    demoLink: site || null,
  };
}

type Claims = { user_metadata?: Record<string, unknown>; app_metadata?: { provider?: unknown; providers?: unknown } } | null | undefined;

/** Usuário do GitHub da pessoa: o do perfil; senão o do login com GitHub. */
export function githubLogin(links: unknown, claims: Claims): string | null {
  const fromProfile = (links && typeof links === "object" ? (links as Record<string, unknown>).github : null) as unknown;
  if (typeof fromProfile === "string" && USER_RE.test(fromProfile)) return fromProfile;
  const app = claims?.app_metadata;
  const providers = Array.isArray(app?.providers) ? app.providers : [app?.provider];
  const name = claims?.user_metadata?.user_name;
  if (providers.includes("github") && typeof name === "string" && USER_RE.test(name)) return name;
  return null;
}
