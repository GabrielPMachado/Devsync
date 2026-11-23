import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getUser, serviceRest, SupabaseError, userRest } from "../src/supabase";
import { fakeFetch } from "./helpers";

describe("cliente Supabase", () => {
  it("insert do usuário usa a chave anon e o JWT dele", async () => {
    const f = fakeFetch(() => Response.json([{ id: "d1" }], { status: 201 }));
    const row = await userRest(env, "jwt-ana", f.fetch).insert<{ id: string }>("demos", { kind: "web_upload" });
    expect(row).toEqual({ id: "d1" });
    const call = f.calls[0]!;
    expect(call.url).toBe("https://sb.test/rest/v1/demos");
    expect(call.method).toBe("POST");
    expect(call.headers.get("apikey")).toBe("anon-key");
    expect(call.headers.get("authorization")).toBe("Bearer jwt-ana");
    expect(call.headers.get("prefer")).toBe("return=representation");
    expect(JSON.parse(call.body!)).toEqual({ kind: "web_upload" });
  });

  it("service_role vai nos dois cabeçalhos", async () => {
    const f = fakeFetch(() => new Response(null, { status: 204 }));
    await serviceRest(env, f.fetch).update("demos", "id=eq.d1", { status: "live" });
    const call = f.calls[0]!;
    expect(call.url).toBe("https://sb.test/rest/v1/demos?id=eq.d1");
    expect(call.method).toBe("PATCH");
    expect(call.headers.get("apikey")).toBe("service-key");
    expect(call.headers.get("authorization")).toBe("Bearer service-key");
  });

  it("select devolve as linhas", async () => {
    const f = fakeFetch(() => Response.json([{ id: "d1" }, { id: "d2" }]));
    const rows = await serviceRest(env, f.fetch).select("demos", "select=id");
    expect(rows).toHaveLength(2);
    expect(f.calls[0]!.url).toBe("https://sb.test/rest/v1/demos?select=id");
  });

  it("erro do PostgREST vira SupabaseError com o código", async () => {
    const f = fakeFetch(() =>
      Response.json({ code: "DS001", message: "Limite de 5 envios de demo por dia" }, { status: 400 }),
    );
    const err = (await userRest(env, "jwt", f.fetch).insert("demos", {}).catch((e: unknown) => e)) as SupabaseError;
    expect(err).toBeInstanceOf(SupabaseError);
    expect(err.code).toBe("DS001");
    expect(err.status).toBe(400);
  });

  it("getUser devolve o id ou null", async () => {
    const ok = fakeFetch(() => Response.json({ id: "u1", email: "a@b.c" }));
    expect(await getUser(env, "jwt", ok.fetch)).toEqual({ id: "u1" });
    expect(ok.calls[0]!.url).toBe("https://sb.test/auth/v1/user");
    expect(ok.calls[0]!.headers.get("authorization")).toBe("Bearer jwt");
    const bad = fakeFetch(() => new Response("{}", { status: 401 }));
    expect(await getUser(env, "jwt", bad.fetch)).toBeNull();
  });
});
