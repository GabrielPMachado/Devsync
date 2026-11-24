import { createMessageBatch, env, getQueueResult, createExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZipMessage } from "../src/env";
import { handleFetch, handleQueue } from "../src/index";
import { clearDemoCache } from "../src/serve";
import { fakeFetch, makeZip, SITE, type Call } from "./helpers";

let ID = "";
let demo: Record<string, unknown>;
const f = fakeFetch((c: Call) => {
  if (c.url.endsWith("/auth/v1/user")) return Response.json({ id: "ana" });
  if (c.method === "POST") return Response.json([{ id: ID, version: 1 }], { status: 201 });
  if (c.method === "PATCH") {
    Object.assign(demo, JSON.parse(c.body!));
    return new Response(null, { status: 204 });
  }
  return Response.json([demo]);
});
const deps = { fetch: f.fetch, now: () => Date.now() };
const auth = { authorization: "Bearer jwt-ana" };

beforeEach(() => {
  ID = crypto.randomUUID();
  demo = { id: ID, kind: "web_upload", status: "pending", version: 1, owner_id: "ana", storage_prefix: null };
  clearDemoCache();
});

describe("roteamento", () => {
  it("host desconhecido é 404", async () => {
    expect((await handleFetch(new Request("https://outro.test/uploads", { method: "POST" }), env, deps)).status).toBe(404);
  });

  it("CORS só para o site", async () => {
    const ok = await handleFetch(
      new Request("https://demos.test/uploads", { method: "OPTIONS", headers: { origin: "https://devsync.app" } }), env, deps);
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://devsync.app");
    expect(ok.headers.get("access-control-allow-headers")).toContain("authorization");
    const bad = await handleFetch(
      new Request("https://demos.test/uploads", { method: "OPTIONS", headers: { origin: "https://mal.dev" } }), env, deps);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rota desconhecida da API é 404", async () => {
    expect((await handleFetch(new Request("https://demos.test/nada"), env, deps)).status).toBe(404);
  });
});

describe("de ponta a ponta", () => {
  it("envia o zip, valida na fila e serve a demo no iframe", async () => {
    const created = await handleFetch(new Request("https://demos.test/uploads", { method: "POST", headers: auth }), env, deps);
    expect(created.status).toBe(201);
    const { demoId, uploadUrl } = (await created.json()) as { demoId: string; uploadUrl: string };

    const zip = makeZip([{ name: "dist/" }, ...SITE.map((e) => ({ ...e, name: `dist/${e.name}` }))]);
    const put = await handleFetch(
      new Request(uploadUrl, { method: "PUT", body: zip, headers: { "content-length": String(zip.length) } }), env, deps);
    expect(put.status).toBe(201);

    const send = vi.spyOn(env.ZIP_QUEUE, "send").mockResolvedValue(undefined as never);
    const done = await handleFetch(new Request(`https://demos.test/uploads/${demoId}/complete`, { method: "POST", headers: auth }), env, deps);
    expect(done.status).toBe(202);
    const message = send.mock.calls[0]![0] as ZipMessage;
    send.mockRestore();

    const batch = createMessageBatch("demo-zips", [{ id: "m1", timestamp: new Date(), attempts: 1, body: message }]);
    const ctx = createExecutionContext();
    await handleQueue(batch, env, deps);
    expect((await getQueueResult(batch, ctx)).explicitAcks).toEqual(["m1"]);
    expect(demo.status).toBe("live");

    const page = await handleFetch(
      new Request(`https://${demoId}.demos.test/`, { headers: { "sec-fetch-dest": "iframe" } }), env, deps);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<h1>Oi</h1>");
    expect(page.headers.get("content-security-policy")).toBe("frame-ancestors https://devsync.app");

    const direct = await handleFetch(
      new Request(`https://${demoId}.demos.test/`, { headers: { "sec-fetch-dest": "document" } }), env, deps);
    expect(direct.headers.get("location")).toBe(`https://devsync.app/demo/${demoId}`);
  });

  it("falha inesperada na fila pede nova tentativa", async () => {
    const broken = { ...deps, fetch: (async () => { throw new Error("fora do ar"); }) as typeof fetch };
    const batch = createMessageBatch("demo-zips", [{ id: "m1", timestamp: new Date(), attempts: 1, body: { demoId: ID, version: 1 } }]);
    const ctx = createExecutionContext();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await handleQueue(batch, env, broken);
    expect((await getQueueResult(batch, ctx)).retryMessages).toEqual([{ msgId: "m1" }]);
  });
});

describe("limite de chamadas da API", () => {
  const blocked = { limit: vi.fn(async () => ({ success: false })) };
  const envWith = (limiter: unknown) => ({ ...env, API_LIMITER: limiter }) as typeof env;

  it.each([
    ["POST", "/uploads"],
    ["POST", "/embed-check"],
    ["POST", `/uploads/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}/complete`],
    ["POST", `/demos/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}/verify`],
  ])("%s %s responde 429 quando passa do limite", async (method, path) => {
    const res = await handleFetch(
      new Request(`https://demos.test${path}`, { method, headers: { ...auth, "cf-connecting-ip": "203.0.113.9", origin: "https://devsync.app" } }),
      envWith(blocked), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://devsync.app");
  });

  it("a chave do limite é o IP de quem chama", async () => {
    blocked.limit.mockClear();
    await handleFetch(new Request("https://demos.test/embed-check", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.9" } }), envWith(blocked), deps);
    expect(blocked.limit).toHaveBeenCalledWith({ key: "203.0.113.9" });
  });

  it("OPTIONS (CORS) não conta no limite", async () => {
    blocked.limit.mockClear();
    const res = await handleFetch(new Request("https://demos.test/uploads", { method: "OPTIONS", headers: { origin: "https://devsync.app" } }), envWith(blocked), deps);
    expect(res.status).toBe(204);
    expect(blocked.limit).not.toHaveBeenCalled();
  });

  it("dentro do limite segue normal", async () => {
    const ok = { limit: vi.fn(async () => ({ success: true })) };
    const res = await handleFetch(new Request("https://demos.test/rota-que-nao-existe", { method: "POST" }), envWith(ok), deps);
    expect(res.status).toBe(404);
    expect(ok.limit).toHaveBeenCalled();
  });
});
