import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDemoCache, parseDemoHost, serveDemo } from "../src/serve";
import { fakeFetch } from "./helpers";

const ID = "6f1c2c1e-1111-4222-8333-444455556666";
const PREFIX = `demos/${ID}/1/`;

let now = 0;
let row: Record<string, unknown> | null;
const supabase = fakeFetch(() => Response.json(row ? [row] : []));
const deps = { fetch: supabase.fetch, now: () => now };

function get(path: string, headers: Record<string, string> = {}) {
  return serveDemo(new Request(`https://${ID}.demos.test${path}`, { headers }), env, ID, deps);
}
const iframe = { "sec-fetch-dest": "iframe" };

beforeEach(async () => {
  clearDemoCache();
  supabase.calls.length = 0;
  now = 1_000_000;
  row = { id: ID, kind: "web_upload", status: "live", storage_prefix: PREFIX };
  await env.DEMOS_BUCKET.put(`${PREFIX}index.html`, "<h1>demo</h1>", { httpMetadata: { contentType: "text/html; charset=utf-8" } });
  await env.DEMOS_BUCKET.put(`${PREFIX}assets/a.js`, "1", { httpMetadata: { contentType: "text/javascript; charset=utf-8" } });
  await env.DEMOS_BUCKET.put(`${PREFIX}logo.svg`, "<svg/>", { httpMetadata: { contentType: "image/svg+xml" } });
});

describe("parseDemoHost", () => {
  it("aceita só <uuid>.<DEMOS_HOST>", () => {
    expect(parseDemoHost(`${ID}.demos.test`, "demos.test")).toBe(ID);
    expect(parseDemoHost(`${ID.toUpperCase()}.demos.test`, "demos.test")).toBe(ID);
    expect(parseDemoHost("demos.test", "demos.test")).toBeNull();
    expect(parseDemoHost("www.demos.test", "demos.test")).toBeNull();
    expect(parseDemoHost(`a.${ID}.demos.test`, "demos.test")).toBeNull();
    expect(parseDemoHost(`${ID}.outro.test`, "demos.test")).toBeNull();
  });
});

describe("serveDemo", () => {
  it("serve o index.html dentro de iframe com CSP", async () => {
    const res = await get("/", iframe);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>demo</h1>");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-security-policy")).toBe("frame-ancestors https://devsync.app");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(supabase.calls[0]!.url).toBe(`https://sb.test/rest/v1/demos?id=eq.${ID}&select=id,kind,status,storage_prefix`);
    expect(supabase.calls[0]!.headers.get("authorization")).toBe("Bearer anon-key");
  });

  it("aberta direto no navegador redireciona para a Devsync", async () => {
    const res = await get("/", { "sec-fetch-dest": "document" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`https://devsync.app/demo/${ID}`);
  });

  it("HTML sem Sec-Fetch-Dest redireciona", async () => {
    const res = await get("/index.html");
    expect(res.status).toBe(302);
  });

  it("SVG aberto como documento redireciona", async () => {
    expect((await get("/logo.svg", { "sec-fetch-dest": "document" })).status).toBe(302);
  });

  it("serve assets para scripts e fetch", async () => {
    const res = await get("/assets/a.js", { "sec-fetch-dest": "script" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect((await get("/logo.svg", { "sec-fetch-dest": "empty" })).status).toBe(200);
  });

  it("recusa registrar service worker", async () => {
    expect((await get("/assets/a.js", { "service-worker": "script", "sec-fetch-dest": "serviceworker" })).status).toBe(403);
  });

  it("rota de SPA sem extensão recebe o index.html", async () => {
    const res = await get("/perfil/ana", iframe);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>demo</h1>");
  });

  it("arquivo com extensão que não existe é 404", async () => {
    expect((await get("/nao-existe.png", { "sec-fetch-dest": "image" })).status).toBe(404);
  });

  it("caminho com .. é 404", async () => {
    expect((await get("/%2e%2e/x.js", { "sec-fetch-dest": "script" })).status).toBe(404);
    expect((await get("/a/..%2f..%2fx.js", { "sec-fetch-dest": "script" })).status).toBe(404);
  });

  it("demo bloqueada (a RLS não devolve) é 404 com aviso", async () => {
    row = null;
    const res = await get("/", iframe);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Demo indisponível");
    expect(res.headers.get("content-security-policy")).toBe("frame-ancestors https://devsync.app");
  });

  it("demo de link ou ainda pendente não é servida", async () => {
    row = { id: ID, kind: "web_link", status: "live", storage_prefix: null };
    expect((await get("/", iframe)).status).toBe(404);
    clearDemoCache();
    row = { id: ID, kind: "web_upload", status: "pending", storage_prefix: null };
    expect((await get("/", iframe)).status).toBe(404);
  });

  it("guarda o status por 30 s", async () => {
    await get("/", iframe);
    row = null;
    now += 29_000;
    expect((await get("/", iframe)).status).toBe(200);
    expect(supabase.calls).toHaveLength(1);
    now += 2_000;
    expect((await get("/", iframe)).status).toBe(404);
    expect(supabase.calls).toHaveLength(2);
  });

  it("só GET e HEAD", async () => {
    const res = await serveDemo(new Request(`https://${ID}.demos.test/`, { method: "POST" }), env, ID, deps);
    expect(res.status).toBe(405);
    const head = await serveDemo(new Request(`https://${ID}.demos.test/`, { method: "HEAD", headers: iframe }), env, ID, deps);
    expect(head.status).toBe(200);
  });
});
