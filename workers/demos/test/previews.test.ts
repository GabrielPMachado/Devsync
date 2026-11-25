import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../src/index";
import { capturePreviews, demoShotUrl } from "../src/previews";
import { clearDemoCache, serveDemo } from "../src/serve";
import { signShot, verifyShot } from "../src/signing";
import { fakeFetch, type Call } from "./helpers";

const LINK = "11111111-1111-4111-8111-111111111111";
const ZIP = "22222222-2222-4222-8222-222222222222";
const NOW = 1_800_000_000_000;
const shotEnv = { ...env, CLOUDFLARE_ACCOUNT_ID: "acc123", BROWSER_RENDERING_TOKEN: "br-token" } as typeof env;

let queue: unknown[] = [];
let shot: () => Response;
const f = fakeFetch((c: Call) => {
  if (c.url.endsWith("/rpc/pending_demo_previews")) return Response.json(queue);
  if (c.url.includes("/browser-rendering/screenshot")) return shot();
  return new Response(null, { status: 204 });
});
const deps = { fetch: f.fetch, now: () => NOW };
const jpeg = () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
const rpcs = () =>
  f.calls.filter((c) => c.url.includes("/rpc/record_demo_preview")).map((c) => JSON.parse(c.body!) as Record<string, unknown>);
const shots = () => f.calls.filter((c) => c.url.includes("/browser-rendering/screenshot"));

beforeEach(() => {
  f.calls.length = 0;
  queue = [];
  shot = jpeg;
  clearDemoCache();
});

describe("signShot / verifyShot", () => {
  it("vale só para a demo certa e até expirar", async () => {
    const sig = await signShot("s", ZIP, 100);
    expect(await verifyShot("s", ZIP, 100, sig, 50)).toBe(true);
    expect(await verifyShot("s", LINK, 100, sig, 50)).toBe(false);
    expect(await verifyShot("s", ZIP, 100, sig, 101)).toBe(false);
    expect(await verifyShot("outro", ZIP, 100, sig, 50)).toBe(false);
  });
});

describe("demoShotUrl", () => {
  it("modo pastas e modo subdomínio", async () => {
    const path = new URL(await demoShotUrl({ ...env, DEMOS_MODE: "path" } as typeof env, ZIP, NOW));
    expect(path.origin + path.pathname).toBe(`https://demos.test/d/${ZIP}/`);
    expect(path.searchParams.get("shot")).toMatch(/^\d+\.[0-9a-f]{64}$/);
    const sub = new URL(await demoShotUrl(env, ZIP, NOW));
    expect(sub.origin + sub.pathname).toBe(`https://${ZIP}.demos.test/`);
  });
});

describe("capturePreviews", () => {
  it("sem token do Browser Rendering não faz nada", async () => {
    await capturePreviews(env, deps);
    expect(f.calls).toHaveLength(0);
  });

  it("tira o print, guarda no R2 e grava a URL pública", async () => {
    queue = [
      { id: LINK, kind: "web_link", url: "https://ana.dev", version: 1 },
      { id: ZIP, kind: "web_upload", url: null, version: 3 },
    ];
    await env.DEMOS_BUCKET.put(`previews/${ZIP}/2.jpg`, "velho");
    await capturePreviews(shotEnv, deps);

    expect(shots()).toHaveLength(2);
    expect(shots()[0]!.url).toBe("https://api.cloudflare.com/client/v4/accounts/acc123/browser-rendering/screenshot");
    expect(shots()[0]!.headers.get("authorization")).toBe("Bearer br-token");
    const body = JSON.parse(shots()[0]!.body!);
    expect(body).toMatchObject({ url: "https://ana.dev", viewport: { width: 1280, height: 720 }, screenshotOptions: { type: "jpeg" } });
    expect(JSON.parse(shots()[1]!.body!).url).toMatch(new RegExp(`^https://${ZIP}\\.demos\\.test/\\?shot=`));

    const obj = await env.DEMOS_BUCKET.get(`previews/${LINK}/1.jpg`);
    expect(obj?.httpMetadata?.contentType).toBe("image/jpeg");
    await obj?.body.cancel();
    expect(await env.DEMOS_BUCKET.head(`previews/${ZIP}/2.jpg`)).toBeNull();
    expect(rpcs()).toEqual([
      { demo_id: LINK, demo_version: 1, preview_url: `https://demos.test/previews/${LINK}/1.jpg` },
      { demo_id: ZIP, demo_version: 3, preview_url: `https://demos.test/previews/${ZIP}/3.jpg` },
    ]);
  });

  it("falha da página conta uma tentativa; limite, token ou Cloudflare fora do ar param sem contar", async () => {
    queue = [
      { id: LINK, kind: "web_link", url: "https://ana.dev", version: 1 },
      { id: ZIP, kind: "web_upload", url: null, version: 1 },
    ];
    shot = () => new Response("página não carregou", { status: 422 });
    await capturePreviews(shotEnv, deps);
    expect(rpcs()).toEqual([
      { demo_id: LINK, demo_version: 1, preview_url: null },
      { demo_id: ZIP, demo_version: 1, preview_url: null },
    ]);

    for (const status of [429, 401, 403, 500, 503]) {
      f.calls.length = 0;
      shot = () => new Response("x", { status });
      await capturePreviews(shotEnv, deps);
      expect(shots()).toHaveLength(1);
      expect(rpcs()).toEqual([]);
    }
  });

  it("resposta que não é imagem é falha", async () => {
    queue = [{ id: LINK, kind: "web_link", url: "https://ana.dev", version: 1 }];
    shot = () => Response.json({ success: false });
    await capturePreviews(shotEnv, deps);
    expect(rpcs()).toEqual([{ demo_id: LINK, demo_version: 1, preview_url: null }]);
  });

  it("ignora linhas estranhas (id inválido, link sem https)", async () => {
    queue = [
      { id: "../x", kind: "web_upload", url: null, version: 1 },
      { id: LINK, kind: "web_link", url: "javascript:alert(1)", version: 1 },
    ];
    await capturePreviews(shotEnv, deps);
    expect(shots()).toHaveLength(0);
  });
});

describe("print das demos enviadas", () => {
  const PREFIX = `demos/${ZIP}/1/`;
  const live = fakeFetch(() => Response.json([{ id: ZIP, kind: "web_upload", status: "live", storage_prefix: PREFIX }]));
  const get = async (search: string, now = Date.now()) =>
    serveDemo(new Request(`https://${ZIP}.demos.test/${search}`, { headers: { "sec-fetch-dest": "document" } }), env, ZIP, { fetch: live.fetch, now: () => now });

  beforeEach(async () => {
    await env.DEMOS_BUCKET.put(`${PREFIX}index.html`, "<h1>zip</h1>", { httpMetadata: { contentType: "text/html; charset=utf-8" } });
  });

  it("com o passe assinado, a página abre direto (para o navegador do print)", async () => {
    const exp = Date.now() + 60_000;
    const res = await get(`?shot=${exp}.${await signShot(env.UPLOAD_SIGNING_SECRET, ZIP, exp)}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>zip</h1>");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("passe vencido, de outra demo ou falso continua redirecionando", async () => {
    const exp = Date.now() + 60_000;
    expect((await get(`?shot=${exp}.${await signShot(env.UPLOAD_SIGNING_SECRET, ZIP, exp)}`, exp + 1)).status).toBe(302);
    expect((await get(`?shot=${exp}.${await signShot(env.UPLOAD_SIGNING_SECRET, LINK, exp)}`)).status).toBe(302);
    expect((await get(`?shot=${exp}.${"0".repeat(64)}`)).status).toBe(302);
    expect((await get(`?shot=lixo`)).status).toBe(302);
  });

  it("o passe de upload não serve de passe de print", async () => {
    const { signUpload } = await import("../src/signing");
    const exp = Date.now() + 60_000;
    expect((await get(`?shot=${exp}.${await signUpload(env.UPLOAD_SIGNING_SECRET, ZIP, 1, exp)}`)).status).toBe(302);
  });
});

describe("GET /previews/<id>/<versão>.jpg", () => {
  const pathEnv = { ...env, DEMOS_MODE: "path" } as typeof env;
  const get = (path: string, e = env) => handleFetch(new Request(`https://demos.test${path}`), e, deps);

  it("serve o print com cache longo, fora do limite da API", async () => {
    await env.DEMOS_BUCKET.put(`previews/${LINK}/1.jpg`, new Uint8Array([1, 2]), { httpMetadata: { contentType: "image/jpeg" } });
    const limited = { ...pathEnv, API_LIMITER: { limit: async () => ({ success: false }) } } as typeof env;
    for (const e of [env, pathEnv, limited]) {
      const res = await get(`/previews/${LINK}/1.jpg`, e);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/jpeg");
      expect(res.headers.get("cache-control")).toContain("immutable");
      await res.arrayBuffer();
    }
  });

  it("pedido condicional com o mesmo ETag responde 304", async () => {
    await env.DEMOS_BUCKET.put(`previews/${LINK}/1.jpg`, new Uint8Array([1, 2]), { httpMetadata: { contentType: "image/jpeg" } });
    const first = await get(`/previews/${LINK}/1.jpg`);
    await first.arrayBuffer();
    const etag = first.headers.get("etag")!;
    const res = await handleFetch(new Request(`https://demos.test/previews/${LINK}/1.jpg`, { headers: { "if-none-match": etag } }), env, deps);
    expect(res.status).toBe(304);
  });

  it("print que não existe ou caminho estranho é 404", async () => {
    expect((await get(`/previews/${LINK}/9.jpg`)).status).toBe(404);
    expect((await get(`/previews/../x.jpg`)).status).toBe(404);
  });
});
