import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { buildProgress, failStaleBuilds, receiveBuildZip, startBuild } from "../src/builds";
import { resetJwksCache } from "../src/oidc";
import { zipKey } from "../src/uploads";
import { fakeFetch, makeZip, SITE, type Call } from "./helpers";
import { BUILDER, claims, makeIssuer } from "./oidc-helpers";

const NOW = 1_700_000_000_000;
const issuer = await makeIssuer();
const e = { ...env, BUILDER_REPO: BUILDER, BUILDER_GITHUB_TOKEN: "gh-token" };

let DEMO = "";
let BUILD = "";
let repoInfo: { status: number; body?: Record<string, unknown> };
let dispatchStatus: number;
let insertError: { code: string; message: string } | null;
let build: Record<string, unknown> | null;
let demo: Record<string, unknown> | null;

const net = fakeFetch((c: Call) => {
  const u = new URL(c.url);
  if (u.hostname === "token.actions.githubusercontent.com") return Response.json(issuer.jwks);
  if (u.hostname === "api.github.com") {
    if (u.pathname.endsWith("/dispatches")) return new Response(null, { status: dispatchStatus });
    return repoInfo.body ? Response.json(repoInfo.body, { status: repoInfo.status }) : new Response("{}", { status: repoInfo.status });
  }
  if (u.pathname === "/auth/v1/user") {
    return c.headers.get("authorization") === "Bearer jwt-ana" ? Response.json({ id: "ana" }) : new Response("{}", { status: 401 });
  }
  const table = u.pathname.replace("/rest/v1/", "");
  if (c.method === "POST" && table === "demos") {
    return insertError ? Response.json(insertError, { status: 400 }) : Response.json([{ id: DEMO, version: 1 }], { status: 201 });
  }
  if (c.method === "POST" && table === "demo_builds") return Response.json([{ id: BUILD }], { status: 201 });
  if (c.method === "PATCH" && table === "demo_builds" && build) {
    const patch = JSON.parse(c.body!) as Record<string, unknown>;
    if (u.searchParams.get("run_id") === "is.null" && build.run_id !== null) return new Response(null, { status: 204 });
    Object.assign(build, patch);
    return new Response(null, { status: 204 });
  }
  if (c.method === "PATCH" && table === "demos" && demo) {
    Object.assign(demo, JSON.parse(c.body!));
    return new Response(null, { status: 204 });
  }
  if (c.method === "GET" && table === "demo_builds") return Response.json(build ? [build] : []);
  if (c.method === "GET" && table === "demos") return Response.json(demo ? [demo] : []);
  return new Response("{}", { status: 500 });
});
const deps = { fetch: net.fetch, now: () => NOW };

beforeEach(() => {
  resetJwksCache();
  net.calls.length = 0;
  DEMO = crypto.randomUUID();
  BUILD = crypto.randomUUID();
  repoInfo = { status: 200, body: { full_name: "ana/financy", private: false, size: 1200, default_branch: "main" } };
  dispatchStatus = 204;
  insertError = null;
  build = { id: BUILD, demo_id: DEMO, stage: "queued", run_id: null };
  demo = { id: DEMO, status: "pending", version: 1 };
});

const start = (body: unknown, headers: Record<string, string> = { authorization: "Bearer jwt-ana" }) =>
  startBuild(new Request("https://demos.test/builds", { method: "POST", headers, body: JSON.stringify(body) }), e, deps);

describe("POST /builds", () => {
  it("cria a demo como o usuário, registra o build e dispara o workflow", async () => {
    const res = await start({ repo: "ana/financy" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ demoId: DEMO, buildId: BUILD });

    const repoCall = net.calls.find((c) => c.url === "https://api.github.com/repos/ana/financy")!;
    expect(repoCall.headers.get("authorization")).toBe("Bearer gh-token");
    const demoInsert = net.calls.find((c) => c.url.endsWith("/rest/v1/demos") && c.method === "POST")!;
    expect(demoInsert.headers.get("authorization")).toBe("Bearer jwt-ana");
    const buildInsert = net.calls.find((c) => c.url.endsWith("/rest/v1/demo_builds") && c.method === "POST")!;
    expect(buildInsert.headers.get("authorization")).toBe("Bearer service-key");
    expect(JSON.parse(buildInsert.body!)).toEqual({ demo_id: DEMO, owner_id: "ana", repo: "ana/financy", ref: "main" });

    const dispatch = net.calls.find((c) => c.url.endsWith("/dispatches"))!;
    expect(dispatch.url).toBe(`https://api.github.com/repos/${BUILDER}/actions/workflows/build-demo.yml/dispatches`);
    expect(JSON.parse(dispatch.body!)).toEqual({
      ref: "main",
      inputs: { build_id: BUILD, repo: "ana/financy", ref: "main", api: "https://demos.test" },
    });
  });

  it("usa a branch pedida quando é válida", async () => {
    await start({ repo: "ana/financy", ref: "release/v2" });
    const dispatch = net.calls.find((c) => c.url.endsWith("/dispatches"))!;
    expect((JSON.parse(dispatch.body!) as { inputs: { ref: string } }).inputs.ref).toBe("release/v2");
  });

  it("recusa nome de repositório ou branch inválido", async () => {
    expect((await start({ repo: "ana/financy;rm -rf" })).status).toBe(400);
    expect((await start({ repo: "../x" })).status).toBe(400);
    expect((await start({ repo: "ana/financy", ref: "-x" })).status).toBe(400);
    expect((await start({ repo: "ana/financy", ref: "a/../b" })).status).toBe(400);
    expect(net.calls.filter((c) => c.url.includes("api.github.com"))).toHaveLength(0);
  });

  it("repositório que não existe, privado ou grande demais", async () => {
    repoInfo = { status: 404 };
    expect((await start({ repo: "ana/nada" })).status).toBe(404);
    repoInfo = { status: 200, body: { full_name: "ana/x", private: true, size: 10, default_branch: "main" } };
    expect((await start({ repo: "ana/x" })).status).toBe(400);
    repoInfo = { status: 200, body: { full_name: "ana/x", private: false, size: 300_000, default_branch: "main" } };
    expect((await start({ repo: "ana/x" })).status).toBe(413);
    expect(net.calls.some((c) => c.url.endsWith("/rest/v1/demos"))).toBe(false);
  });

  it("sem login é 401 e limite diário é 429", async () => {
    expect((await start({ repo: "ana/financy" }, {})).status).toBe(401);
    insertError = { code: "DS001", message: "Limite de 5 envios de demo por dia" };
    expect((await start({ repo: "ana/financy" })).status).toBe(429);
  });

  it("falha ao disparar marca o build e a demo como falhos", async () => {
    dispatchStatus = 500;
    const res = await start({ repo: "ana/financy" });
    expect(res.status).toBe(502);
    expect(build).toMatchObject({ stage: "failed", error: "dispatch_failed" });
    expect(demo).toMatchObject({ status: "unavailable", rejection_reason: "build_failed" });
  });

  it("branch padrão com nome que o compilador não aceita é 400", async () => {
    repoInfo = { status: 200, body: { full_name: "ana/x", private: false, size: 10, default_branch: "feat+x" } };
    expect((await start({ repo: "ana/x" })).status).toBe(400);
    expect(net.calls.some((c) => c.url.endsWith("/rest/v1/demos"))).toBe(false);
  });

  it("sem configuração do build é 503", async () => {
    const res = await startBuild(
      new Request("https://demos.test/builds", { method: "POST", headers: { authorization: "Bearer jwt-ana" }, body: "{}" }),
      { ...env, BUILDER_REPO: undefined },
      deps,
    );
    expect(res.status).toBe(503);
  });
});

async function runnerHeaders(extra: Record<string, unknown> = {}) {
  return { authorization: `Bearer ${await issuer.sign(claims(NOW / 1000, extra))}`, "content-type": "application/json" };
}
const progress = async (body: unknown, extra: Record<string, unknown> = {}, id = BUILD) =>
  buildProgress(
    new Request(`https://demos.test/builds/${id}/progress`, { method: "POST", headers: await runnerHeaders(extra), body: JSON.stringify(body) }),
    e,
    id,
    deps,
  );

describe("POST /builds/:id/progress", () => {
  it("o primeiro run assume o build e grava a etapa", async () => {
    const res = await progress({ stage: "cloning" });
    expect(res.status).toBe(200);
    expect(build).toMatchObject({ run_id: 4242, stage: "cloning" });
    const res2 = await progress({ stage: "building", framework: "vite" });
    expect(res2.status).toBe(200);
    expect(build).toMatchObject({ stage: "building", framework: "vite" });
  });

  it("outro run não mexe no build", async () => {
    build!.run_id = 1;
    expect((await progress({ stage: "cloning" })).status).toBe(403);
    expect(build!.stage).toBe("queued");
  });

  it("sem token válido é 401", async () => {
    const res = await buildProgress(
      new Request(`https://demos.test/builds/${BUILD}/progress`, { method: "POST", body: JSON.stringify({ stage: "cloning" }) }),
      e, BUILD, deps,
    );
    expect(res.status).toBe(401);
    expect((await progress({ stage: "cloning" }, { repository: "alguem/outro" })).status).toBe(401);
  });

  it("etapa inválida, para trás ou de build encerrado", async () => {
    expect((await progress({ stage: "ready" })).status).toBe(400);
    expect((await progress({ stage: "building", error: "x".repeat(100) })).status).toBe(400);
    await progress({ stage: "building" });
    expect((await progress({ stage: "cloning" })).status).toBe(409);
    build!.stage = "ready";
    expect((await progress({ stage: "failed", error: "build_failed" })).status).toBe(409);
  });

  it("falha grava o erro, o fim do log e derruba a demo", async () => {
    const log = "linha\n".repeat(3000);
    const res = await progress({ stage: "failed", error: "build_failed", log });
    expect(res.status).toBe(200);
    expect(build).toMatchObject({ stage: "failed", error: "build_failed" });
    expect((build!.log as string).length).toBe(8000);
    expect(log.endsWith(build!.log as string)).toBe(true);
    expect(demo).toMatchObject({ status: "unavailable", rejection_reason: "build_failed" });
  });

  it("build que não existe é 404", async () => {
    build = null;
    expect((await progress({ stage: "cloning" })).status).toBe(404);
  });
});

describe("PUT /builds/:id/zip", () => {
  const zip = makeZip(SITE);
  const put = async (body: Uint8Array, extra: Record<string, unknown> = {}) =>
    receiveBuildZip(
      new Request(`https://demos.test/builds/${BUILD}/zip`, {
        method: "PUT",
        headers: { ...(await runnerHeaders(extra)), "content-length": String(body.length) },
        body,
      }),
      e,
      BUILD,
      deps,
    );

  it("grava o zip no lugar do envio da demo e enfileira a validação", async () => {
    const sent: unknown[] = [];
    const ee = { ...e, ZIP_QUEUE: { send: async (m: unknown) => void sent.push(m) } as unknown as Queue };
    const res = await receiveBuildZip(
      new Request(`https://demos.test/builds/${BUILD}/zip`, {
        method: "PUT",
        headers: { ...(await runnerHeaders()), "content-length": String(zip.length) },
        body: zip,
      }),
      ee, BUILD, deps,
    );
    expect(res.status).toBe(202);
    expect(await env.DEMOS_BUCKET.head(zipKey(DEMO, 1))).not.toBeNull();
    expect(sent).toEqual([{ demoId: DEMO, version: 1 }]);
    expect(build).toMatchObject({ stage: "validating", run_id: 4242 });
  });

  it("acima de 25 MB é 413 e de outro run é 403", async () => {
    const res = await receiveBuildZip(
      new Request(`https://demos.test/builds/${BUILD}/zip`, {
        method: "PUT",
        headers: { ...(await runnerHeaders()), "content-length": String(26 * 1024 * 1024) },
        body: zip,
      }),
      e, BUILD, deps,
    );
    expect(res.status).toBe(413);
    build!.run_id = 7;
    expect((await put(zip)).status).toBe(403);
  });

  it("reenvio depois de o zip já estar gravado segue a validação", async () => {
    await env.DEMOS_BUCKET.put(zipKey(DEMO, 1), zip);
    build!.stage = "uploading";
    const sent: unknown[] = [];
    const ee = { ...e, ZIP_QUEUE: { send: async (m: unknown) => void sent.push(m) } as unknown as Queue };
    const res = await receiveBuildZip(
      new Request(`https://demos.test/builds/${BUILD}/zip`, {
        method: "PUT",
        headers: { ...(await runnerHeaders()), "content-length": String(zip.length) },
        body: zip,
      }),
      ee, BUILD, deps,
    );
    expect(res.status).toBe(202);
    expect(sent).toEqual([{ demoId: DEMO, version: 1 }]);
  });

  it("demo que já saiu de pendente é 409", async () => {
    demo!.status = "live";
    expect((await put(zip)).status).toBe(409);
  });
});

describe("failStaleBuilds", () => {
  it("encerra builds parados há mais de 40 minutos", async () => {
    const stale = [{ id: BUILD, demo_id: DEMO }];
    const f = fakeFetch((c: Call) => {
      if (c.method === "GET") return Response.json(stale);
      return new Response(null, { status: 204 });
    });
    await failStaleBuilds(e, { fetch: f.fetch, now: () => NOW });
    const get = f.calls.find((c) => c.method === "GET")!;
    const q = new URL(get.url).searchParams;
    expect(q.get("stage")).toBe("not.in.(ready,failed)");
    expect(q.get("updated_at")).toBe(`lt.${new Date(NOW - 40 * 60_000).toISOString()}`);
    const patches = f.calls.filter((c) => c.method === "PATCH").map((c) => [new URL(c.url).pathname, JSON.parse(c.body!)]);
    expect(patches).toEqual([
      ["/rest/v1/demo_builds", { stage: "failed", error: "stalled" }],
      ["/rest/v1/demos", { status: "unavailable", rejection_reason: "build_failed" }],
    ]);
  });
});
