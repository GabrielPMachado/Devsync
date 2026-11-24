/** Chave RSA de teste e emissão de tokens no formato do OIDC do GitHub Actions. */
const b64url = (bytes: Uint8Array | string) => {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function makeIssuer(kid = "chave-1") {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const jwks = { keys: [{ ...jwk, kid, alg: "RS256", use: "sig" }] };
  async function sign(claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
    const h = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid, ...header }));
    const p = b64url(JSON.stringify(claims));
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(`${h}.${p}`));
    return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
  }
  return { jwks, sign };
}

export const BUILDER = "devsync/devsync-builds";

export function claims(nowSec: number, extra: Record<string, unknown> = {}) {
  return {
    iss: "https://token.actions.githubusercontent.com",
    aud: "devsync-builds",
    iat: nowSec - 10,
    nbf: nowSec - 10,
    exp: nowSec + 300,
    repository: BUILDER,
    workflow_ref: `${BUILDER}/.github/workflows/build-demo.yml@refs/heads/main`,
    ref: "refs/heads/main",
    event_name: "workflow_dispatch",
    run_id: "4242",
    ...extra,
  };
}
