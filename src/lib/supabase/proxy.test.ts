// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const createServerClient = vi.fn();
vi.mock("@supabase/ssr", () => ({ createServerClient }));

const { updateSession } = await import("./proxy");

describe("updateSession", () => {
  it("deixa a página abrir sem chamar o Supabase quando ele não está configurado", async () => {
    const res = await updateSession(new NextRequest("http://localhost/"), null);
    expect(res.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("renova a sessão e repassa os cookies quando está configurado", async () => {
    createServerClient.mockImplementation((_url, _key, { cookies }) => ({
      auth: {
        getClaims: async () => {
          await cookies.setAll(
            [{ name: "sb-token", value: "novo", options: { path: "/" } }],
            { "Cache-Control": "private, no-store" },
          );
          return { data: null, error: null };
        },
      },
    }));
    const res = await updateSession(new NextRequest("http://localhost/"), {
      url: "https://abc.supabase.co",
      anonKey: "chave",
    });
    expect(createServerClient).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "chave",
      expect.anything(),
    );
    expect(res.cookies.get("sb-token")?.value).toBe("novo");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
