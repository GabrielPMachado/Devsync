import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeUpload, createUpload, receiveUpload } from "../src/uploads";
import { signUpload } from "../src/signing";
import { fakeFetch, makeZip, SITE, type Call } from "./helpers";

let ID = "";
const NOW = 1_700_000_000_000;

let demoRow: Record<string, unknown> | null;
let insertError: { code: string; message: string } | null;
const supabase = fakeFetch((c: Call) => {
  if (c.url.endsWith("/auth/v1/user")) {
    return c.headers.get("authorization") === "Bearer jwt-ana"
      ? Response.json({ id: "ana" })
      : new Response("{}", { status: 401 });
  }
  if (c.method === "POST") {
    return insertError ? Response.json(insertError, { status: 400 }) : Response.json([{ id: ID, version: 1 }], { status: 201 });
  }
  return Response.json(demoRow ? [demoRow] : []);
});
const deps = { fetch: supabase.fetch, now: () => NOW };
const auth = { authorization: "Bearer jwt-ana" };

beforeEach(() => {
  ID = crypto.randomUUID();
  supabase.calls.length = 0;
  demoRow = { id: ID, kind: "web_upload", status: "pending", version: 1, owner_id: "ana" };
  insertError = null;
});

describe("POST /uploads", () => {
  it("cria a demo como o usuário e devolve a URL de envio", async () => {
    const res = await createUpload(new Request("https://demos.test/uploads", { method: "POST", headers: auth }), env, deps);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { demoId: string; uploadUrl: string };
    expect(body.demoId).toBe(ID);
    const url = new URL(body.uploadUrl);
    expect(url.origin + url.pathname).toBe(`https://demos.test/uploads/${ID}/1`);
    expect(Number(url.searchParams.get("expires"))).toBe(NOW + 10 * 60_000);
    expect(url.searchParams.get("sig")).toBe(await signUpload("segredo-de-teste", ID, 1, NOW + 10 * 60_000));
    const insert = supabase.calls.find((c) => c.method === "POST")!;
    expect(insert.url).toBe("https://sb.test/rest/v1/demos");
    expect(insert.headers.get("authorization")).toBe("Bearer jwt-ana");
    expect(JSON.parse(insert.body!)).toEqual({ kind: "web_upload" });
  });

  it("sem login é 401", async () => {
    const res = await createUpload(new Request("https://demos.test/uploads", { method: "POST" }), env, deps);
    expect(res.status).toBe(401);
    const bad = await createUpload(
      new Request("https://demos.test/uploads", { method: "POST", headers: { authorization: "Bearer x" } }), env, deps);
    expect(bad.status).toBe(401);
  });

  it("limite diário é 429 e e-mail não confirmado é 403", async () => {
    insertError = { code: "DS001", message: "Limite de 5 envios de demo por dia" };
    const r1 = await createUpload(new Request("https://demos.test/uploads", { method: "POST", headers: auth }), env, deps);
    expect(r1.status).toBe(429);
    expect(await r1.json()).toEqual({ error: "Limite de 5 envios de demo por dia" });
    insertError = { code: "DS002", message: "Confirme seu e-mail para enviar demos" };
    const r2 = await createUpload(new Request("https://demos.test/uploads", { method: "POST", headers: auth }), env, deps);
    expect(r2.status).toBe(403);
    insertError = { code: "42501", message: "new row violates row-level security policy" };
    const r3 = await createUpload(new Request("https://demos.test/uploads", { method: "POST", headers: auth }), env, deps);
    expect(r3.status).toBe(403);
  });
});

describe("PUT do arquivo", () => {
  async function put(body: BodyInit, opts: { version?: number; expires?: number; sig?: string; length?: number } = {}) {
    const expires = opts.expires ?? NOW + 60_000;
    const sig = opts.sig ?? (await signUpload("segredo-de-teste", ID, 1, expires));
    const bytes = body instanceof Uint8Array ? body : new TextEncoder().encode(String(body));
    const headers: Record<string, string> = { "content-length": String(opts.length ?? bytes.length) };
    return receiveUpload(
      new Request(`https://demos.test/uploads/${ID}/${opts.version ?? 1}?expires=${expires}&sig=${sig}`, {
        method: "PUT", headers, body: bytes,
      }),
      env, ID, opts.version ?? 1, deps,
    );
  }

  it("grava o zip no R2", async () => {
    const zip = makeZip(SITE);
    expect((await put(zip)).status).toBe(201);
    const obj = await env.DEMOS_BUCKET.get(`uploads/${ID}/1.zip`);
    expect(obj?.size).toBe(zip.length);
  });

  it("assinatura expirada ou de outra versão é 403", async () => {
    expect((await put("x", { expires: NOW - 1 })).status).toBe(403);
    expect((await put("x", { version: 2 })).status).toBe(403);
  });

  it("acima de 25 MB é 413", async () => {
    expect((await put("x", { length: 25 * 1024 * 1024 + 1 })).status).toBe(413);
  });

  it("não sobrescreve um envio", async () => {
    expect((await put("a")).status).toBe(201);
    expect((await put("b")).status).toBe(409);
  });
});

describe("POST /uploads/:id/complete", () => {
  const complete = (headers: Record<string, string> = auth) =>
    completeUpload(new Request(`https://demos.test/uploads/${ID}/complete`, { method: "POST", headers }), env, ID, deps);

  it("enfileira a validação", async () => {
    await env.DEMOS_BUCKET.put(`uploads/${ID}/1.zip`, makeZip(SITE));
    const send = vi.spyOn(env.ZIP_QUEUE, "send").mockResolvedValue(undefined as never);
    const res = await complete();
    expect(res.status).toBe(202);
    expect(send).toHaveBeenCalledWith({ demoId: ID, version: 1 });
    const select = supabase.calls.find((c) => c.method === "GET" && c.url.includes("/rest/v1/demos"))!;
    expect(select.url).toContain(`id=eq.${ID}`);
    expect(select.url).toContain("owner_id=eq.ana");
    expect(select.headers.get("authorization")).toBe("Bearer jwt-ana");
    send.mockRestore();
  });

  it("demo de outra pessoa é 404", async () => {
    demoRow = null;
    expect((await complete()).status).toBe(404);
  });

  it("demo que não está pendente é 409", async () => {
    demoRow = { ...demoRow, status: "live" };
    expect((await complete()).status).toBe(409);
  });

  it("sem zip enviado é 409", async () => {
    expect((await complete()).status).toBe(409);
  });
});
