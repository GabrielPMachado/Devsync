import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const prod = {
  supabaseUrl: "https://abc.supabase.co",
  demosUrl: "https://devsync-demos.com",
  dev: false,
};

function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
      const [name, ...values] = d.split(/\s+/);
      return [name, values];
    }),
  );
}

describe("contentSecurityPolicy", () => {
  it("não deixa a Devsync ser embutida em outro site", () => {
    expect(directives(contentSecurityPolicy(prod))["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("bloqueia plugins e troca de base", () => {
    const d = directives(contentSecurityPolicy(prod));
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
  });

  it("libera a API e o Realtime do Supabase", () => {
    const d = directives(contentSecurityPolicy(prod));
    expect(d["connect-src"]).toEqual(expect.arrayContaining(["'self'", "https://abc.supabase.co", "wss://abc.supabase.co"]));
  });

  it("libera a API de demos e cada subdomínio de demo no iframe", () => {
    const d = directives(contentSecurityPolicy(prod));
    expect(d["connect-src"]).toContain("https://devsync-demos.com");
    expect(d["frame-src"]).toEqual(expect.arrayContaining(["https://*.devsync-demos.com", "https:"]));
  });

  it("deixa o login do GitHub sair do formulário", () => {
    const d = directives(contentSecurityPolicy(prod));
    expect(d["form-action"]).toEqual(expect.arrayContaining(["'self'", "https://abc.supabase.co", "https://github.com"]));
  });

  it("em produção não aceita eval e força https", () => {
    const csp = contentSecurityPolicy(prod);
    expect(directives(csp)["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("no ambiente local aceita http do Supabase e das demos", () => {
    const d = directives(contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", demosUrl: "http://demos.localhost:8787", dev: true }));
    expect(d["connect-src"]).toEqual(expect.arrayContaining(["http://127.0.0.1:54321", "ws://127.0.0.1:54321", "http://demos.localhost:8787"]));
    expect(d["frame-src"]).toContain("http://*.demos.localhost:8787");
    expect(d["script-src"]).toContain("'unsafe-eval'");
    expect(d["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("build de produção apontando para o Supabase local (E2E) não força https", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", demosUrl: "http://demos.localhost:8787", dev: false });
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(directives(csp)["script-src"]).not.toContain("'unsafe-eval'");
  });

  it("o navegador pode ler a API pública do GitHub (importar projeto)", () => {
    expect(directives(contentSecurityPolicy({ dev: false }))["connect-src"]).toContain("https://api.github.com");
  });

  it("sem Supabase nem demos configurados continua válida", () => {
    const d = directives(contentSecurityPolicy({ dev: false }));
    expect(d["connect-src"]).toEqual(["'self'", "https://api.github.com"]);
    expect(d["default-src"]).toEqual(["'self'"]);
  });

  it("ignora URL inválida em vez de quebrar o build", () => {
    expect(() => contentSecurityPolicy({ supabaseUrl: "nada", demosUrl: "::", dev: false })).not.toThrow();
  });
});

describe("securityHeaders", () => {
  it("tem os cabeçalhos básicos", () => {
    const h = Object.fromEntries(securityHeaders(prod).map(({ key, value }) => [key, value]));
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d{8,}/);
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });
});
