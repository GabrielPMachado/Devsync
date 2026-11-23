import { describe, expect, it } from "vitest";
import { demoFrameSrc, demosBaseUrl } from "./url";

const base = new URL("http://demos.localhost:8787");

describe("demosBaseUrl", () => {
  it("lê a URL do serviço de demos", () => {
    expect(demosBaseUrl("http://demos.localhost:8787")?.host).toBe("demos.localhost:8787");
  });
  it("vazio ou inválido vira null", () => {
    expect(demosBaseUrl("")).toBeNull();
    expect(demosBaseUrl(undefined)).toBeNull();
    expect(demosBaseUrl("nada")).toBeNull();
  });
});

describe("demoFrameSrc", () => {
  it("demo enviada abre no subdomínio próprio", () => {
    expect(demoFrameSrc({ id: "abc", kind: "web_upload", url: null }, base)).toBe("http://abc.demos.localhost:8787/");
    expect(demoFrameSrc({ id: "abc", kind: "web_upload", url: null }, new URL("https://devsync-demos.app"))).toBe("https://abc.devsync-demos.app/");
  });
  it("link abre a própria URL", () => {
    expect(demoFrameSrc({ id: "abc", kind: "web_link", url: "https://meu.app/" }, base)).toBe("https://meu.app/");
  });
  it("sem serviço configurado ou tipo futuro: null", () => {
    expect(demoFrameSrc({ id: "abc", kind: "web_upload", url: null }, null)).toBeNull();
    expect(demoFrameSrc({ id: "abc", kind: "sandbox", url: null }, base)).toBeNull();
  });
});
