import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { embedCheck, recheckLink, scheduleLinkChecks, verifyDemo } from "../src/links";
import { fakeFetch, type Call } from "./helpers";

const ID = "8f1c2c1e-1111-4222-8333-444455556666";
const NOW = Date.UTC(2026, 10, 23, 6, 0, 0);
let demoRow: Record<string, unknown> | null;
let siteHeaders: Record<string, string>;
let listRows: { id: string }[];

const f = fakeFetch((c: Call) => {
  if (c.url.endsWith("/auth/v1/user")) {
    return c.headers.get("authorization") === "Bearer jwt-ana" ? Response.json({ id: "ana" }) : new Response("{}", { status: 401 });
  }
  if (c.url.startsWith("https://sb.test/rest/v1/demos")) {
    if (c.method === "PATCH") return new Response(null, { status: 204 });
    if (c.url.includes("kind=eq.web_link&status=in.")) return Response.json(listRows);
    return Response.json(demoRow ? [demoRow] : []);
  }
  return new Response("<html>", { headers: siteHeaders });
});
const deps = { fetch: f.fetch, now: () => NOW };
const auth = { authorization: "Bearer jwt-ana", "content-type": "application/json" };
const patches = () => f.calls.filter((c) => c.method === "PATCH");

beforeEach(() => {
  f.calls.length = 0;
  demoRow = { id: ID, kind: "web_link", status: "pending", url: "https://ana.dev" };
  siteHeaders = {};
  listRows = [];
});

describe("POST /embed-check", () => {
  const post = (body: unknown, headers: Record<string, string> = auth) =>
    embedCheck(new Request("https://demos.test/embed-check", { method: "POST", headers, body: JSON.stringify(body) }), env, deps);

  it("responde se o link pode ser embutido", async () => {
    expect(await (await post({ url: "https://ana.dev" })).json()).toEqual({ embeddable: true });
    siteHeaders = { "x-frame-options": "DENY" };
    expect(await (await post({ url: "https://ana.dev" })).json()).toEqual({ embeddable: false, reason: "x_frame_options" });
  });

  it("exige login e url", async () => {
    expect((await post({ url: "https://ana.dev" }, { "content-type": "application/json" })).status).toBe(401);
    expect((await post({})).status).toBe(400);
  });
});

describe("POST /demos/:id/verify", () => {
  const verify = () => verifyDemo(new Request(`https://demos.test/demos/${ID}/verify`, { method: "POST", headers: auth }), env, ID, deps);

  it("link embutível vira live", async () => {
    const res = await verify();
    expect(await res.json()).toEqual({ embeddable: true });
    const select = f.calls.find((c) => c.method === "GET" && c.url.includes("/rest/v1/demos"))!;
    expect(select.url).toContain("owner_id=eq.ana");
    expect(select.headers.get("authorization")).toBe("Bearer jwt-ana");
    const [patch] = patches();
    expect(patch!.url).toBe(`https://sb.test/rest/v1/demos?id=eq.${ID}&status=neq.blocked&url=eq.https%3A%2F%2Fana.dev`);
    expect(patch!.headers.get("authorization")).toBe("Bearer service-key");
    expect(JSON.parse(patch!.body!)).toEqual({ status: "live", embeddable: true, checked_at: new Date(NOW).toISOString() });
  });

  it("link que bloqueia vira unavailable", async () => {
    siteHeaders = { "content-security-policy": "frame-ancestors 'self'" };
    expect(await (await verify()).json()).toEqual({ embeddable: false, reason: "csp_frame_ancestors" });
    expect(JSON.parse(patches()[0]!.body!)).toMatchObject({ status: "unavailable", embeddable: false });
  });

  it("demo bloqueada não é rechecada", async () => {
    demoRow = { ...demoRow, status: "blocked" };
    expect((await verify()).status).toBe(409);
    expect(patches()).toHaveLength(0);
  });

  it("demo de outra pessoa ou de zip é 404", async () => {
    demoRow = null;
    expect((await verify()).status).toBe(404);
    demoRow = { id: ID, kind: "web_upload", status: "live", url: null };
    expect((await verify()).status).toBe(404);
  });
});

describe("checagem diária", () => {
  it("enfileira os links em lotes de 100", async () => {
    listRows = Array.from({ length: 150 }, (_, i) => ({ id: `id-${i}` }));
    const send = vi.spyOn(env.LINK_QUEUE, "sendBatch").mockResolvedValue({} as never);
    await scheduleLinkChecks(env, deps);
    const list = f.calls[0]!;
    expect(list.url).toBe(
      "https://sb.test/rest/v1/demos?kind=eq.web_link&status=in.(live,unavailable)&select=id&order=checked_at.asc.nullsfirst&limit=1000",
    );
    expect(list.headers.get("authorization")).toBe("Bearer service-key");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]![0]).toHaveLength(100);
    expect([...send.mock.calls[1]![0]][0]).toEqual({ body: { demoId: "id-100" } });
    send.mockRestore();
  });

  it("link que passou a bloquear vira unavailable", async () => {
    demoRow = { ...demoRow, status: "live" };
    siteHeaders = { "x-frame-options": "SAMEORIGIN" };
    await recheckLink({ demoId: ID }, env, deps);
    const [patch] = patches();
    expect(patch!.url).toBe(`https://sb.test/rest/v1/demos?id=eq.${ID}&status=neq.blocked&url=eq.https%3A%2F%2Fana.dev`);
    expect(JSON.parse(patch!.body!)).toMatchObject({ status: "unavailable", embeddable: false });
  });

  it("não mexe em demo bloqueada", async () => {
    demoRow = { ...demoRow, status: "blocked" };
    await recheckLink({ demoId: ID }, env, deps);
    expect(patches()).toHaveLength(0);
  });
});
