import { describe, expect, it } from "vitest";
import { getSupabaseEnv } from "./env";

describe("getSupabaseEnv", () => {
  it("devolve null quando o Supabase ainda não foi configurado", () => {
    expect(getSupabaseEnv({})).toBeNull();
    expect(getSupabaseEnv({ url: "", anonKey: "" })).toBeNull();
  });

  it("devolve URL e chave quando as duas existem", () => {
    expect(getSupabaseEnv({ url: "https://abc.supabase.co", anonKey: "chave" })).toEqual({
      url: "https://abc.supabase.co",
      anonKey: "chave",
    });
  });

  it("explica em pt-BR quando a URL é inválida", () => {
    expect(() => getSupabaseEnv({ url: "abc.supabase.co", anonKey: "chave" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("explica em pt-BR quando só uma das variáveis foi preenchida", () => {
    expect(() => getSupabaseEnv({ url: "https://abc.supabase.co" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
    expect(() => getSupabaseEnv({ anonKey: "chave" })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
