export type SupabaseEnv = { url: string; anonKey: string };

type RawSupabaseEnv = { url?: string; anonKey?: string };

// Acesso literal a process.env.NEXT_PUBLIC_*: é o que o Next.js troca pelo valor no bundle do navegador.
const fromProcess = (): RawSupabaseEnv => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Lê as variáveis do Supabase. Devolve `null` quando nenhuma foi preenchida
 * (clone novo, CI): o site abre, só sem login. Lança erro quando a
 * configuração está pela metade ou com URL inválida.
 */
export function getSupabaseEnv(raw: RawSupabaseEnv = fromProcess()): SupabaseEnv | null {
  const url = raw.url?.trim() ?? "";
  const anonKey = raw.anonKey?.trim() ?? "";

  if (!url && !anonKey) return null;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL no .env.local (a chave anon já está lá).");
  if (!anonKey) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local (a URL já está lá).");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL inválida: "${url}". Use algo como https://<projeto>.supabase.co`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL precisa começar com http:// ou https://. Valor atual: "${url}"`);
  }

  return { url, anonKey };
}
