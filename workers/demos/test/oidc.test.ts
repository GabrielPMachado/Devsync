import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetJwksCache, verifyActionsToken } from "../src/oidc";
import { fakeFetch } from "./helpers";
import { BUILDER, claims, makeIssuer } from "./oidc-helpers";

const NOW = 1_700_000_000_000;
const SEC = NOW / 1000;
const issuer = await makeIssuer();
const jwks = fakeFetch(() => Response.json(issuer.jwks));
const deps = { fetch: jwks.fetch, now: () => NOW };
const e = { ...env, BUILDER_REPO: BUILDER };

beforeEach(() => {
  resetJwksCache();
  jwks.calls.length = 0;
});

describe("verifyActionsToken", () => {
  it("aceita token do workflow de build e devolve o run", async () => {
    const res = await verifyActionsToken(await issuer.sign(claims(SEC)), e, deps);
    expect(res).toEqual({ runId: 4242 });
    expect(jwks.calls[0]!.url).toBe("https://token.actions.githubusercontent.com/.well-known/jwks");
    // A segunda chamada usa as chaves guardadas.
    await verifyActionsToken(await issuer.sign(claims(SEC)), e, deps);
    expect(jwks.calls).toHaveLength(1);
  });

  it.each([
    ["outro repositório", { repository: "alguem/outro" }],
    ["outro workflow", { workflow_ref: `${BUILDER}/.github/workflows/outro.yml@refs/heads/main` }],
    ["outra branch", { workflow_ref: `${BUILDER}/.github/workflows/build-demo.yml@refs/heads/dev` }],
    ["outro evento", { event_name: "push" }],
    ["outra audiência", { aud: "sts.amazonaws.com" }],
    ["outro emissor", { iss: "https://evil.test" }],
    ["vencido", { exp: SEC - 1 }],
    ["ainda não vale", { nbf: SEC + 600 }],
    ["sem run", { run_id: "abc" }],
  ])("recusa token de %s", async (_n, extra) => {
    expect(await verifyActionsToken(await issuer.sign(claims(SEC, extra)), e, deps)).toBeNull();
  });

  it("recusa assinatura de outra chave, alg diferente e lixo", async () => {
    const other = await makeIssuer();
    expect(await verifyActionsToken(await other.sign(claims(SEC)), e, deps)).toBeNull();
    expect(await verifyActionsToken(await issuer.sign(claims(SEC), { alg: "none" }), e, deps)).toBeNull();
    expect(await verifyActionsToken("a.b.c", e, deps)).toBeNull();
    expect(await verifyActionsToken("", e, deps)).toBeNull();
  });

  it("sem BUILDER_REPO configurado recusa tudo", async () => {
    expect(await verifyActionsToken(await issuer.sign(claims(SEC)), { ...env, BUILDER_REPO: undefined }, deps)).toBeNull();
  });
});
