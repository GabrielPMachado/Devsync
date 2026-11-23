export type EmbedReason =
  | "invalid_url"
  | "not_https"
  | "unsafe"
  | "unreachable"
  | "http_error"
  | "too_many_redirects"
  | "x_frame_options"
  | "csp_frame_ancestors";

export interface EmbedResult {
  embeddable: boolean;
  reason?: EmbedReason;
}

export interface EmbedDeps {
  fetch: typeof fetch;
  safeBrowsingKey?: string;
}

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const no = (reason: EmbedReason): EmbedResult => ({ embeddable: false, reason });

/** Confere se a URL é pública e https. Devolve o motivo da recusa, ou null. */
function urlProblem(raw: string): { url: URL } | { reason: EmbedReason } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { reason: "invalid_url" };
  }
  if (url.protocol === "http:") return { reason: "not_https" };
  if (url.protocol !== "https:" || url.port || url.username || url.password) return { reason: "invalid_url" };
  const host = url.hostname.toLowerCase();
  const isIp = /^\d+(\.\d+){3}$/.test(host) || host.startsWith("[");
  if (isIp || host === "localhost" || host.endsWith(".localhost") || !host.includes(".")) return { reason: "invalid_url" };
  return { url };
}

const DEFAULT_PORT: Record<string, string> = { "https:": "443", "http:": "80" };

/** Uma expressão de fonte de frame-ancestors cobre a origem do site? */
function sourceMatches(source: string, site: URL): boolean {
  const s = source.toLowerCase();
  if (s === "*") return true;
  if (s === "'self'" || s === "'none'") return false;
  if (s === "https:") return site.protocol === "https:";
  if (s === "http:") return site.protocol === "http:" || site.protocol === "https:";
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([a-z0-9.-]+|\*)(?::(\d+|\*))?(?:\/.*)?$/.exec(s);
  if (!m) return false;
  const [, scheme, wildcard, host, port] = m;
  // Sem esquema, vale o da página embutida (sempre https aqui).
  const effective = scheme ?? "https";
  if (!(`${effective}:` === site.protocol || (effective === "http" && site.protocol === "https:"))) return false;
  const siteHost = site.hostname.toLowerCase();
  // "scheme://*" cobre qualquer host; "*.x.com" cobre só subdomínios.
  if (host !== "*" && (wildcard ? !siteHost.endsWith(`.${host}`) : siteHost !== host)) return false;
  if (port === "*") return true;
  const sitePort = site.port || DEFAULT_PORT[site.protocol];
  // Sem porta na fonte, vale a porta padrão do esquema do site.
  return sitePort === (port ?? DEFAULT_PORT[site.protocol]);
}

function frameAncestorPolicies(csp: string | null): string[][] {
  if (!csp) return [];
  const out: string[][] = [];
  for (const policy of csp.split(",")) {
    for (const directive of policy.split(";")) {
      const [name, ...values] = directive.trim().split(/\s+/);
      if (name?.toLowerCase() === "frame-ancestors") out.push(values);
    }
  }
  return out;
}

function headersBlock(headers: Headers, site: URL): EmbedReason | null {
  const policies = frameAncestorPolicies(headers.get("content-security-policy"));
  if (policies.length > 0) {
    // Com frame-ancestors, o navegador ignora o X-Frame-Options.
    const allowed = policies.every((sources) => sources.some((src) => sourceMatches(src, site)));
    return allowed ? null : "csp_frame_ancestors";
  }
  const xfo = (headers.get("x-frame-options") ?? "").toLowerCase().split(",").map((v) => v.trim());
  return xfo.includes("deny") || xfo.includes("sameorigin") ? "x_frame_options" : null;
}

/** Falha aberta: erro da API do Safe Browsing não impede a publicação. */
async function isUnsafe(urls: string[], key: string, f: typeof fetch): Promise<boolean> {
  const res = await f(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client: { clientId: "devsync", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: urls.map((url) => ({ url })),
      },
    }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { matches?: unknown[] };
  return (data.matches?.length ?? 0) > 0;
}

/** O site em `rawUrl` aceita ser embutido em iframe na `siteUrl`? */
export async function checkEmbeddable(rawUrl: string, siteUrl: string, deps: EmbedDeps): Promise<EmbedResult> {
  const first = urlProblem(rawUrl);
  if ("reason" in first) return no(first.reason);
  const site = new URL(siteUrl);

  let url = first.url;
  const hops = [url.href];
  for (let hop = 0; ; hop++) {
    let res: Response;
    try {
      res = await deps.fetch(url.href, {
        redirect: "manual",
        headers: { "user-agent": "DevsyncEmbedCheck/1.0 (+https://devsync.app)", accept: "text/html" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return no("unreachable");
    }
    await res.body?.cancel();

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= MAX_REDIRECTS) return no("too_many_redirects");
      const next = urlProblem(new URL(location, url).href);
      if ("reason" in next) return no(next.reason);
      url = next.url;
      hops.push(url.href);
      continue;
    }
    if (!res.ok) return no("http_error");
    const blocked = headersBlock(res.headers, site);
    if (blocked) return no(blocked);
    // Checa todos os endereços do caminho, inclusive os redirecionamentos.
    if (deps.safeBrowsingKey && (await isUnsafe(hops, deps.safeBrowsingKey, deps.fetch).catch(() => false))) {
      return no("unsafe");
    }
    return { embeddable: true };
  }
}
