import { describe, expect, it, vi } from "vitest";
import { completeUpload, createUpload, DemoServiceError, embedCheck, putZip, verifyDemo, waitForDemo } from "./client";

const base = new URL("http://demos.localhost:8787");

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(body === null ? null : JSON.stringify(body), { status }));
}

describe("chamadas ao serviço de demos", () => {
  it("createUpload manda o token e devolve demoId e uploadUrl", async () => {
    const f = fakeFetch(201, { demoId: "d1", uploadUrl: "http://demos.localhost:8787/uploads/d1/1?sig=x" });
    await expect(createUpload({ base, token: "t", fetch: f })).resolves.toEqual({ demoId: "d1", uploadUrl: "http://demos.localhost:8787/uploads/d1/1?sig=x" });
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toBe("http://demos.localhost:8787/uploads");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer t");
  });

  it("erro vira DemoServiceError com o status e a mensagem do serviço", async () => {
    const f = fakeFetch(429, { error: "Limite de 5 envios de demo por dia" });
    const err = await createUpload({ base, token: "t", fetch: f }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DemoServiceError);
    expect(err).toMatchObject({ status: 429, message: "Limite de 5 envios de demo por dia" });
  });

  it("putZip envia o arquivo com PUT", async () => {
    const f = fakeFetch(201, { ok: true });
    const file = new Blob(["zip"]);
    await putZip("http://demos.localhost:8787/uploads/d1/1?sig=x", file, f);
    expect(f.mock.calls[0]![1]).toMatchObject({ method: "PUT", body: file });
  });

  it("completeUpload, embedCheck e verifyDemo usam as rotas do contrato", async () => {
    const f = fakeFetch(202, null);
    await completeUpload({ base, token: "t", fetch: f }, "d1");
    expect(String(f.mock.calls[0]![0])).toBe("http://demos.localhost:8787/uploads/d1/complete");

    const g = fakeFetch(200, { embeddable: false, reason: "x_frame_options" });
    await expect(embedCheck({ base, token: "t", fetch: g }, "https://a.dev")).resolves.toEqual({ embeddable: false, reason: "x_frame_options" });
    expect(String(g.mock.calls[0]![0])).toBe("http://demos.localhost:8787/embed-check");
    expect(JSON.parse(String(g.mock.calls[0]![1]?.body))).toEqual({ url: "https://a.dev" });

    const h = fakeFetch(200, { embeddable: true });
    await expect(verifyDemo({ base, token: "t", fetch: h }, "d1")).resolves.toEqual({ embeddable: true });
    expect(String(h.mock.calls[0]![0])).toBe("http://demos.localhost:8787/demos/d1/verify");
  });
});

describe("waitForDemo", () => {
  const sleep = async () => {};

  it("espera sair de pending", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending", rejection_reason: null })
      .mockResolvedValueOnce({ status: "pending", rejection_reason: null })
      .mockResolvedValueOnce({ status: "live", rejection_reason: null });
    await expect(waitForDemo(read, { sleep })).resolves.toEqual({ status: "live" });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("zip recusado devolve o motivo", async () => {
    const read = vi.fn().mockResolvedValue({ status: "unavailable", rejection_reason: "no_index" });
    await expect(waitForDemo(read, { sleep })).resolves.toEqual({ status: "unavailable", reason: "no_index" });
  });

  it("desiste depois do tempo limite", async () => {
    let t = 0;
    const read = vi.fn().mockResolvedValue({ status: "pending", rejection_reason: null });
    const result = await waitForDemo(read, { sleep: async (ms) => void (t += ms), now: () => t, timeoutMs: 90_000, intervalMs: 1_500 });
    expect(result).toEqual({ status: "timeout" });
    expect(read.mock.calls.length).toBeGreaterThanOrEqual(60);
  });
});
