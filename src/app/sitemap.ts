import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { publicBaseUrl } from "@/lib/seo/base-url";
import { sitemapEntries, type SitemapRows } from "@/lib/seo/sitemap-entries";

// Limite de URLs por sitemap do Google é 50 mil; com folga por tipo.
const PER_KIND = 5000;

async function loadRows(): Promise<SitemapRows> {
  "use cache";
  cacheLife("hours");

  const empty: SitemapRows = { projects: [], questions: [], profiles: [] };
  const env = getSupabaseEnv();
  if (!env) return empty;

  // Cliente anônimo: a RLS já tira conteúdo oculto, como para qualquer visitante.
  const supabase = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
  try {
    const [projects, questions, profiles] = await Promise.all([
      supabase.from("projects").select("slug, updated_at").is("hidden_at", null).order("updated_at", { ascending: false }).limit(PER_KIND),
      supabase.from("questions").select("slug, updated_at").is("hidden_at", null).order("updated_at", { ascending: false }).limit(PER_KIND),
      supabase.from("profiles").select("username, updated_at").not("username", "is", null).is("suspended_at", null).order("updated_at", { ascending: false }).limit(PER_KIND),
    ]);
    for (const r of [projects, questions, profiles]) {
      if (r.error) console.error("sitemap: falha ao ler o Supabase", r.error.message);
    }
    return {
      projects: projects.data ?? [],
      questions: questions.data ?? [],
      profiles: (profiles.data ?? []).filter((p): p is { username: string; updated_at: string } => !!p.username),
    };
  } catch {
    // Supabase fora do ar (projeto pausado): o sitemap sai só com as páginas fixas.
    return empty;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(publicBaseUrl(), await loadRows());
}
