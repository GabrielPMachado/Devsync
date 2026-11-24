import { describe, expect, it, vi } from "vitest";
import { absolutizeReadme, GithubError, importDraft, listRepos, mapTags, repoDetails, type GithubRepo } from "./github";

const repo: GithubRepo = {
  name: "kanban",
  fullName: "ana/kanban",
  description: "Quadro kanban",
  htmlUrl: "https://github.com/ana/kanban",
  homepage: "https://kanban.ana.dev",
  language: "TypeScript",
  topics: ["reactjs", "supabase"],
  fork: false,
  pushedAt: "2026-11-20T00:00:00Z",
  defaultBranch: "main",
};

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
}

const apiRepo = (over: Record<string, unknown> = {}) => ({
  name: "kanban",
  full_name: "ana/kanban",
  description: "Quadro kanban",
  html_url: "https://github.com/ana/kanban",
  homepage: "https://kanban.ana.dev",
  language: "TypeScript",
  topics: ["reactjs"],
  fork: false,
  pushed_at: "2026-11-20T00:00:00Z",
  default_branch: "main",
  ...over,
});

describe("listRepos", () => {
  it("pede os repositórios públicos mais recentes e tira forks", async () => {
    const fetchFn = vi.fn(async () => res(200, [apiRepo(), apiRepo({ name: "fork", full_name: "ana/fork", fork: true })]));
    const repos = await listRepos("ana", fetchFn);
    expect(fetchFn).toHaveBeenCalledWith("https://api.github.com/users/ana/repos?per_page=100&sort=pushed&type=owner", expect.anything());
    expect(repos).toEqual([{ ...repo, topics: ["reactjs"] }]);
  });

  it("usuário inexistente vira not_found", async () => {
    await expect(listRepos("ninguem", async () => res(404, { message: "Not Found" }))).rejects.toMatchObject({ code: "not_found" });
  });

  it("usuário inválido nem chama a API", async () => {
    const fetchFn = vi.fn();
    await expect(listRepos("a/b", fetchFn)).rejects.toMatchObject({ code: "not_found" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("limite estourado vira rate_limit com a hora de voltar", async () => {
    const err = await listRepos("ana", async () => res(403, { message: "rate" }, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" })).catch((e) => e);
    expect(err).toBeInstanceOf(GithubError);
    expect(err.code).toBe("rate_limit");
    expect(err.resetAt).toEqual(new Date(1800000000 * 1000));
  });

  it("falha de rede vira network", async () => {
    await expect(listRepos("ana", async () => Promise.reject(new TypeError("fail")))).rejects.toMatchObject({ code: "network" });
  });
});

describe("repoDetails", () => {
  it("lê o README cru e as linguagens por bytes", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.endsWith("/readme") ? res(200, "# Kanban") : res(200, { CSS: 10, TypeScript: 900, HTML: 50 }),
    );
    expect(await repoDetails(repo, fetchFn)).toEqual({ readme: "# Kanban", languages: ["TypeScript", "HTML", "CSS"] });
    expect(fetchFn).toHaveBeenCalledWith("https://api.github.com/repos/ana/kanban/readme", expect.objectContaining({ headers: { Accept: "application/vnd.github.raw+json" } }));
  });

  it("sem README devolve null", async () => {
    const fetchFn = async (url: string) => (url.endsWith("/readme") ? res(404, {}) : res(200, {}));
    expect(await repoDetails(repo, fetchFn)).toEqual({ readme: null, languages: [] });
  });
});

describe("mapTags", () => {
  const available = ["react", "typescript", "go", "css", "sql", "tailwindcss", "supabase", "backend", "html"];
  it("usa apelidos, só os existentes, sem repetir, até 5", () => {
    expect(mapTags(["ReactJS", "react", "golang", "Unknown", "SCSS", "PLpgSQL", "tailwind", "TypeScript"], available)).toEqual(["react", "go", "css", "sql", "tailwindcss"]);
  });
  it("nodejs vira backend", () => {
    expect(mapTags(["nodejs"], available)).toEqual(["backend"]);
  });
});

describe("absolutizeReadme", () => {
  it("links relativos apontam para o GitHub, o resto fica", () => {
    const md = "[docs](docs/a.md) [abs](https://x.dev) [ancora](#uso) [raiz](/LICENSE) [ponto](./b.md)";
    expect(absolutizeReadme(md, repo)).toBe(
      "[docs](https://github.com/ana/kanban/blob/main/docs/a.md) [abs](https://x.dev) [ancora](#uso) [raiz](https://github.com/ana/kanban/blob/main/LICENSE) [ponto](https://github.com/ana/kanban/blob/main/b.md)",
    );
  });
});

describe("importDraft", () => {
  const available = ["react", "typescript", "supabase"];
  it("preenche tudo e usa a homepage como demo", () => {
    expect(importDraft(repo, { readme: "# Kanban\n[a](a.md)", languages: ["TypeScript"] }, available)).toEqual({
      title: "kanban",
      description: "# Kanban\n[a](https://github.com/ana/kanban/blob/main/a.md)",
      tags: ["react", "supabase", "typescript"],
      repoUrl: "https://github.com/ana/kanban",
      siteUrl: "https://kanban.ana.dev",
      demoLink: "https://kanban.ana.dev",
    });
  });

  it("sem README ou README grande demais usa a descrição do repo", () => {
    expect(importDraft(repo, { readme: null, languages: [] }, available).description).toBe("Quadro kanban");
    expect(importDraft(repo, { readme: "x".repeat(20_001), languages: [] }, available).description).toBe("Quadro kanban");
    expect(importDraft({ ...repo, description: null }, { readme: null, languages: [] }, available).description).toBe("");
  });

  it("homepage sem https não vira site nem demo", () => {
    const d = importDraft({ ...repo, homepage: "http://x.dev" }, { readme: null, languages: [] }, available);
    expect(d.siteUrl).toBe("");
    expect(d.demoLink).toBeNull();
    expect(importDraft({ ...repo, homepage: "" }, { readme: null, languages: [] }, available).demoLink).toBeNull();
  });

  it("nome curto demais ganha o dono para passar do mínimo", () => {
    expect(importDraft({ ...repo, name: "ui", fullName: "ana/ui" }, { readme: null, languages: [] }, available).title).toBe("ana/ui");
  });
});
