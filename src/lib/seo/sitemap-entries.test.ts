import { describe, expect, it } from "vitest";
import { sitemapEntries } from "./sitemap-entries";

const base = new URL("https://devsync.app");

describe("sitemapEntries", () => {
  it("sempre tem as páginas públicas fixas", () => {
    const urls = sitemapEntries(base, { projects: [], questions: [], profiles: [] }).map((e) => e.url);
    expect(urls).toEqual(["https://devsync.app/", "https://devsync.app/projetos", "https://devsync.app/estudos"]);
  });

  it("inclui projetos, perguntas e perfis com a data da última mudança", () => {
    const entries = sitemapEntries(base, {
      projects: [{ slug: "meu-app-k3x9qa", updated_at: "2026-11-20T10:00:00Z" }],
      questions: [{ slug: "como-centralizar-ab12cd", updated_at: "2026-11-21T10:00:00Z" }],
      profiles: [{ username: "gabriel", updated_at: "2026-11-22T10:00:00Z" }],
    });
    expect(entries.slice(3)).toEqual([
      { url: "https://devsync.app/projetos/meu-app-k3x9qa", lastModified: new Date("2026-11-20T10:00:00Z") },
      { url: "https://devsync.app/estudos/como-centralizar-ab12cd", lastModified: new Date("2026-11-21T10:00:00Z") },
      { url: "https://devsync.app/@gabriel", lastModified: new Date("2026-11-22T10:00:00Z") },
    ]);
  });

  it("codifica o slug na URL", () => {
    const [entry] = sitemapEntries(base, { projects: [{ slug: "a b", updated_at: "2026-11-20T10:00:00Z" }], questions: [], profiles: [] }).slice(3);
    expect(entry.url).toBe("https://devsync.app/projetos/a%20b");
  });
});
