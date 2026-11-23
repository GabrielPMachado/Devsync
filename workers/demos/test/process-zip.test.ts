import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { processZip } from "../src/process-zip";
import { fakeFetch, makeZip, SITE, type Call } from "./helpers";

let ID = "";
let demoRow: Record<string, unknown> | null;
const supabase = fakeFetch((c: Call) =>
  c.method === "GET" ? Response.json(demoRow ? [demoRow] : []) : new Response(null, { status: 204 }),
);
const deps = { fetch: supabase.fetch, now: () => 0 };
const patches = () => supabase.calls.filter((c) => c.method === "PATCH");

beforeEach(() => {
  ID = crypto.randomUUID();
  supabase.calls.length = 0;
  demoRow = { id: ID, kind: "web_upload", status: "pending", version: 1 };
});

describe("processZip", () => {
  it("zip válido: grava os arquivos e publica", async () => {
    await env.DEMOS_BUCKET.put(`uploads/${ID}/1.zip`, makeZip([{ name: "dist/" }, ...SITE.map((e) => ({ ...e, name: `dist/${e.name}` }))]));
    await processZip({ demoId: ID, version: 1 }, env, deps);

    const listed = await env.DEMOS_BUCKET.list({ prefix: `demos/${ID}/1/` });
    expect(listed.objects.map((o) => o.key).sort()).toEqual([
      `demos/${ID}/1/assets/app.js`, `demos/${ID}/1/assets/style.css`, `demos/${ID}/1/index.html`,
    ]);
    const css = await env.DEMOS_BUCKET.get(`demos/${ID}/1/assets/style.css`);
    expect(css?.httpMetadata?.contentType).toBe("text/css; charset=utf-8");

    const [patch] = patches();
    expect(patch!.url).toBe(`https://sb.test/rest/v1/demos?id=eq.${ID}&status=eq.pending`);
    expect(patch!.headers.get("authorization")).toBe("Bearer service-key");
    expect(JSON.parse(patch!.body!)).toEqual({
      status: "live", storage_prefix: `demos/${ID}/1/`, version: 1, rejection_reason: null,
    });
    expect(await env.DEMOS_BUCKET.head(`uploads/${ID}/1.zip`)).toBeNull();
  });

  it("zip inválido: marca unavailable com o motivo e não grava nada", async () => {
    await env.DEMOS_BUCKET.put(`uploads/${ID}/1.zip`, makeZip([...SITE, { name: "../fora.js", data: "x" }]));
    await processZip({ demoId: ID, version: 1 }, env, deps);
    expect((await env.DEMOS_BUCKET.list({ prefix: `demos/${ID}/` })).objects).toHaveLength(0);
    expect(JSON.parse(patches()[0]!.body!)).toEqual({ status: "unavailable", rejection_reason: "unsafe_path" });
    expect(await env.DEMOS_BUCKET.head(`uploads/${ID}/1.zip`)).toBeNull();
  });

  it("demo que já não está pendente: só apaga o zip", async () => {
    demoRow = { ...demoRow, status: "blocked" };
    await env.DEMOS_BUCKET.put(`uploads/${ID}/1.zip`, makeZip(SITE));
    await processZip({ demoId: ID, version: 1 }, env, deps);
    expect(patches()).toHaveLength(0);
    expect(await env.DEMOS_BUCKET.head(`uploads/${ID}/1.zip`)).toBeNull();
    expect((await env.DEMOS_BUCKET.list({ prefix: `demos/${ID}/` })).objects).toHaveLength(0);
  });

  it("demo apagada: só apaga o zip", async () => {
    demoRow = null;
    await env.DEMOS_BUCKET.put(`uploads/${ID}/1.zip`, makeZip(SITE));
    await processZip({ demoId: ID, version: 1 }, env, deps);
    expect(patches()).toHaveLength(0);
    expect(await env.DEMOS_BUCKET.head(`uploads/${ID}/1.zip`)).toBeNull();
  });

  it("zip sumiu (reentrega da fila): não faz nada", async () => {
    await processZip({ demoId: ID, version: 1 }, env, deps);
    expect(patches()).toHaveLength(0);
  });
});
