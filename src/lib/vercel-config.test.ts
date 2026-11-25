import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

// Cabeçalhos do vercel.json SUBSTITUEM os do next.config na Vercel: um
// Content-Security-Policy ali apaga a política completa do site.
// Em 2026-11-25 um vercel.json com só "frame-ancestors" foi para produção e
// o site ficou sem script-src, connect-src etc.
describe("vercel.json", () => {
  it("não define cabeçalhos de segurança que já vêm do next.config", () => {
    const path = join(process.cwd(), "vercel.json");
    if (!existsSync(path)) return;
    const config = JSON.parse(readFileSync(path, "utf8")) as {
      headers?: { headers: { key: string }[] }[];
    };
    const ours = new Set(
      securityHeaders({ supabaseUrl: "https://x.supabase.co", demosUrl: "", dev: false }).map((h) =>
        h.key.toLowerCase(),
      ),
    );
    const keys = (config.headers ?? []).flatMap((r) => r.headers.map((h) => h.key.toLowerCase()));
    expect(keys.filter((k) => ours.has(k))).toEqual([]);
  });
});
