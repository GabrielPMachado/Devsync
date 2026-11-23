import { describe, expect, it } from "vitest";
import { checkEmbeddable } from "../src/embed";
import { fakeFetch, type Call } from "./helpers";

const SITE = "https://devsync.app";
const page = (headers: Record<string, string> = {}, status = 200) => () => new Response("<html>", { status, headers });
const check = (url: string, handler: (c: Call) => Response, key?: string) => {
  const f = fakeFetch(handler);
  return checkEmbeddable(url, SITE, { fetch: f.fetch, safeBrowsingKey: key }).then((r) => ({ ...r, calls: f.calls }));
};

describe("checkEmbeddable", () => {
  it("sem cabeçalhos de bloqueio é embutível", async () => {
    const r = await check("https://ana.dev/app", page());
    expect(r.embeddable).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(r.calls[0]!.url).toBe("https://ana.dev/app");
  });

  it.each(["DENY", "sameorigin", "SAMEORIGIN, DENY"])("X-Frame-Options %s bloqueia", async (xfo) => {
    expect(await check("https://ana.dev", page({ "x-frame-options": xfo }))).toMatchObject({
      embeddable: false, reason: "x_frame_options",
    });
  });

  it("X-Frame-Options desconhecido é ignorado, como nos navegadores", async () => {
    expect((await check("https://ana.dev", page({ "x-frame-options": "ALLOW-FROM https://x.com" }))).embeddable).toBe(true);
  });

  it.each(["frame-ancestors 'self'", "frame-ancestors 'none'", "default-src 'self'; frame-ancestors https://outro.dev"])(
    "CSP %s bloqueia",
    async (csp) => {
      expect(await check("https://ana.dev", page({ "content-security-policy": csp }))).toMatchObject({
        embeddable: false, reason: "csp_frame_ancestors",
      });
    },
  );

  it.each(["frame-ancestors *", "frame-ancestors https:", "frame-ancestors 'self' https://devsync.app", "frame-ancestors devsync.app", "frame-ancestors https://devsync.app:443"])(
    "CSP %s permite",
    async (csp) => {
      expect((await check("https://ana.dev", page({ "content-security-policy": csp }))).embeddable).toBe(true);
    },
  );

  it("CSP frame-ancestors manda mais que X-Frame-Options", async () => {
    const r = await check("https://ana.dev", page({ "content-security-policy": "frame-ancestors https://devsync.app", "x-frame-options": "DENY" }));
    expect(r.embeddable).toBe(true);
  });

  it("curinga de subdomínio não cobre o domínio raiz", async () => {
    const r = await check("https://ana.dev", page({ "content-security-policy": "frame-ancestors https://*.devsync.app" }));
    expect(r.reason).toBe("csp_frame_ancestors");
  });

  it("várias políticas: todas precisam permitir", async () => {
    const r = await check("https://ana.dev", page({ "content-security-policy": "frame-ancestors *, frame-ancestors 'self'" }));
    expect(r.reason).toBe("csp_frame_ancestors");
  });

  it("só https, sem IP, localhost ou porta", async () => {
    expect((await check("http://ana.dev", page())).reason).toBe("not_https");
    for (const url of ["https://127.0.0.1", "https://[::1]/", "https://localhost", "https://ana.dev:8443", "nada", "https://u:p@ana.dev"]) {
      expect((await check(url, page())).reason, url).toBe("invalid_url");
    }
  });

  it("segue redirecionamentos e checa cada um", async () => {
    const r = await check("https://ana.dev", (c) =>
      c.url === "https://ana.dev/" ? new Response(null, { status: 301, headers: { location: "/app" } }) : new Response("ok"),
    );
    expect(r.embeddable).toBe(true);
    expect(r.calls.map((c) => c.url)).toEqual(["https://ana.dev/", "https://ana.dev/app"]);
    const http = await check("https://ana.dev", () => new Response(null, { status: 302, headers: { location: "http://ana.dev/" } }));
    expect(http.reason).toBe("not_https");
  });

  it("mais de 5 redirecionamentos", async () => {
    let n = 0;
    const r = await check("https://ana.dev", () => new Response(null, { status: 302, headers: { location: `/r${n++}` } }));
    expect(r.reason).toBe("too_many_redirects");
    expect(r.calls).toHaveLength(6);
  });

  it("erro HTTP e site fora do ar", async () => {
    expect((await check("https://ana.dev", page({}, 404))).reason).toBe("http_error");
    expect((await check("https://ana.dev", () => { throw new TypeError("network"); })).reason).toBe("unreachable");
  });

  it("Safe Browsing marca site perigoso", async () => {
    const r = await check("https://mal.dev", (c) =>
      c.url.startsWith("https://safebrowsing.googleapis.com/v4/threatMatches:find?key=k")
        ? Response.json({ matches: [{ threatType: "SOCIAL_ENGINEERING" }] })
        : new Response("ok"), "k");
    expect(r).toMatchObject({ embeddable: false, reason: "unsafe" });
    const sb = JSON.parse(r.calls[0]!.body!);
    expect(sb.threatInfo.threatEntries).toEqual([{ url: "https://mal.dev/" }]);
  });

  it("Safe Browsing sem match segue para a checagem", async () => {
    const r = await check("https://ana.dev", (c) => (c.url.includes("safebrowsing") ? Response.json({}) : new Response("ok")), "k");
    expect(r.embeddable).toBe(true);
  });
});
