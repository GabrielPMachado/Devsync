import type { Deps, Env } from "./env";

/** Tokens OIDC do GitHub Actions: o workflow de build prova quem é sem guardar segredo. */
export const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
export const OIDC_AUDIENCE = "devsync-builds";
export const BUILD_WORKFLOW = "build-demo.yml";

const JWKS_TTL_MS = 60 * 60_000;
/** Recarga forçada (kid desconhecido) no máximo uma vez por minuto: token de lixo não vira chamada ao GitHub. */
const JWKS_REFRESH_MS = 60_000;
let cache: { at: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;
let lastForced = -Infinity;

export function resetJwksCache() {
  cache = null;
  lastForced = -Infinity;
}

async function loadKeys(deps: Deps, force: boolean) {
  if (cache && !force && deps.now() - cache.at < JWKS_TTL_MS) return cache.keys;
  if (cache && force) {
    if (deps.now() - lastForced < JWKS_REFRESH_MS) return cache.keys;
    lastForced = deps.now();
  }
  const res = await deps.fetch(`${OIDC_ISSUER}/.well-known/jwks`);
  if (!res.ok) throw new Error(`JWKS do GitHub respondeu ${res.status}`);
  const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  cache = { at: deps.now(), keys: body.keys ?? [] };
  return cache.keys;
}

function decode(part: string): Uint8Array {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function decodeJson(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decode(part))) as Record<string, unknown>;
}

/** Confere o token do run de build. Devolve o run, ou null se o token não for do nosso workflow. */
export async function verifyActionsToken(token: string, env: Env, deps: Deps): Promise<{ runId: number } | null> {
  const repo = env.BUILDER_REPO?.toLowerCase();
  if (!repo) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  let signature: Uint8Array;
  try {
    header = decodeJson(parts[0]!);
    claims = decodeJson(parts[1]!);
    signature = decode(parts[2]!);
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

  let jwk = (await loadKeys(deps, false)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await loadKeys(deps, true)).find((k) => k.kid === header.kid); // chave nova do GitHub
  if (!jwk) return null;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  } catch {
    return null;
  }
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed))) return null;

  const now = deps.now() / 1000;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== OIDC_ISSUER || !aud.includes(OIDC_AUDIENCE)) return null;
  if (typeof claims.exp !== "number" || claims.exp <= now) return null;
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) return null;
  if (String(claims.repository).toLowerCase() !== repo) return null;
  // Se o repositório de builds for apagado ou renomeado, outra conta pode registrar o mesmo nome.
  if (env.BUILDER_REPO_ID && String(claims.repository_id) !== env.BUILDER_REPO_ID) return null;
  if (String(claims.workflow_ref).toLowerCase() !== `${repo}/.github/workflows/${BUILD_WORKFLOW}@refs/heads/main`) return null;
  if (claims.event_name !== "workflow_dispatch") return null;
  const runId = Number(claims.run_id);
  if (!Number.isSafeInteger(runId) || runId <= 0 || !/^\d+$/.test(String(claims.run_id))) return null;
  return { runId };
}
