import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { purgeDeletedDemos } from "../src/deletions";
import { fakeFetch, type Call } from "./helpers";

let pending: string[] = [];
const supabase = fakeFetch((c: Call) => {
  if (c.url.endsWith("/rpc/pending_demo_deletions")) return Response.json(pending);
  return new Response(null, { status: 204 });
});
const deps = { fetch: supabase.fetch, now: () => 0 };

beforeEach(() => {
  supabase.calls.length = 0;
});

describe("purgeDeletedDemos", () => {
  it("apaga os arquivos das demos excluídas e baixa a fila", async () => {
    const gone = crypto.randomUUID();
    const kept = crypto.randomUUID();
    await env.DEMOS_BUCKET.put(`demos/${gone}/1/index.html`, "a");
    await env.DEMOS_BUCKET.put(`demos/${gone}/2/assets/app.js`, "b");
    await env.DEMOS_BUCKET.put(`uploads/${gone}/3.zip`, "c");
    await env.DEMOS_BUCKET.put(`previews/${gone}/2.jpg`, "p");
    await env.DEMOS_BUCKET.put(`demos/${kept}/1/index.html`, "d");
    pending = [gone];

    await purgeDeletedDemos(env, deps);

    expect((await env.DEMOS_BUCKET.list({ prefix: `demos/${gone}/` })).objects).toEqual([]);
    expect((await env.DEMOS_BUCKET.list({ prefix: `uploads/${gone}/` })).objects).toEqual([]);
    expect((await env.DEMOS_BUCKET.list({ prefix: `previews/${gone}/` })).objects).toEqual([]);
    expect(await env.DEMOS_BUCKET.head(`demos/${kept}/1/index.html`)).not.toBeNull();

    const rpc = supabase.calls.map((c) => [new URL(c.url).pathname, c.body && JSON.parse(c.body)]);
    expect(rpc).toEqual([
      ["/rest/v1/rpc/pending_demo_deletions", { max_rows: 50 }],
      ["/rest/v1/rpc/finish_demo_deletions", { demo_ids: [gone] }],
    ]);
    expect(supabase.calls[0]!.headers.get("authorization")).toBe(`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  });

  it("fila vazia: não chama mais nada", async () => {
    pending = [];
    await purgeDeletedDemos(env, deps);
    expect(supabase.calls).toHaveLength(1);
  });

  it("ignora o que não é id de demo (nunca apaga fora da pasta da demo)", async () => {
    await env.DEMOS_BUCKET.put("demos/x", "e");
    pending = ["", "../"];
    await purgeDeletedDemos(env, deps);
    expect(await env.DEMOS_BUCKET.head("demos/x")).not.toBeNull();
    expect(supabase.calls.map((c) => new URL(c.url).pathname)).toEqual(["/rest/v1/rpc/pending_demo_deletions"]);
  });
});
