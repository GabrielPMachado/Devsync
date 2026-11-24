import { describe, expect, it } from "vitest";
import { publicBaseUrl } from "./base-url";

describe("publicBaseUrl", () => {
  it("usa NEXT_PUBLIC_SITE_URL sem barra no fim", () => {
    expect(publicBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://devsync.app/" }).href).toBe("https://devsync.app/");
  });

  it("sem ela, usa o endereço de produção da Vercel", () => {
    expect(publicBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "devsync-br.vercel.app" }).origin).toBe("https://devsync-br.vercel.app");
  });

  it("sem nada, cai no localhost", () => {
    expect(publicBaseUrl({}).origin).toBe("http://localhost:3000");
  });

  it("ignora valor inválido", () => {
    expect(publicBaseUrl({ NEXT_PUBLIC_SITE_URL: "não é url", VERCEL_PROJECT_PRODUCTION_URL: "devsync-br.vercel.app" }).origin).toBe("https://devsync-br.vercel.app");
  });
});
