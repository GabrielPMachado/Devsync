import type { MetadataRoute } from "next";

export type SitemapRows = {
  projects: { slug: string; updated_at: string }[];
  questions: { slug: string; updated_at: string }[];
  profiles: { username: string; updated_at: string }[];
};

/** Páginas públicas que o Google deve achar. Rotas de login, admin e edição ficam de fora. */
export function sitemapEntries(base: URL, rows: SitemapRows): MetadataRoute.Sitemap {
  const at = (path: string) => new URL(path, base).href;
  return [
    { url: at("/"), changeFrequency: "hourly", priority: 1 },
    { url: at("/projetos"), changeFrequency: "hourly", priority: 0.8 },
    { url: at("/estudos"), changeFrequency: "hourly", priority: 0.8 },
    ...rows.projects.map((p) => ({ url: at(`/projetos/${encodeURIComponent(p.slug)}`), lastModified: new Date(p.updated_at) })),
    ...rows.questions.map((q) => ({ url: at(`/estudos/${encodeURIComponent(q.slug)}`), lastModified: new Date(q.updated_at) })),
    ...rows.profiles.map((u) => ({ url: at(`/@${encodeURIComponent(u.username)}`), lastModified: new Date(u.updated_at) })),
  ];
}
