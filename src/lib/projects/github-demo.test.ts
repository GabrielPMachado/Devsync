import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type { GithubRepo } from "./github";
import { buildDemoZip, findSiteSource, isDemoFile, needsBuild, pickFolder } from "./github-demo";

const repo: GithubRepo = {
  name: "kanban",
  fullName: "ana/kanban",
  description: null,
  htmlUrl: "https://github.com/ana/kanban",
  homepage: null,
  language: "JavaScript",
  topics: [],
  fork: false,
  pushedAt: "2026-11-20T00:00:00Z",
  defaultBranch: "main",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const blob = (path: string, size = 10) => ({ path, type: "blob", size });
const tree = (...items: object[]) => ({ truncated: false, tree: items });

describe("pickFolder", () => {
  it("prefere dist, build, docs, out e por fim a raiz", () => {
    expect(pickFolder(["index.html", "docs/index.html", "dist/index.html"])).toBe("dist/");
    expect(pickFolder(["index.html", "docs/index.html"])).toBe("docs/");
    expect(pickFolder(["index.html", "src/a.js"])).toBe("");
    expect(pickFolder(["src/index.html", "README.md"])).toBeNull();
  });
});

describe("needsBuild", () => {
  it("index.html que aponta para código-fonte precisa de build", () => {
    expect(needsBuild('<script type="module" src="/src/main.tsx"></script>')).toBe(true);
    expect(needsBuild('<script type="module" src="./src/index.jsx"></script>')).toBe(true);
    expect(needsBuild('<script src="app.ts"></script>')).toBe(true);
    expect(needsBuild('<script type="module" src="/assets/index-abc.js"></script>')).toBe(false);
    expect(needsBuild("<h1>Oi</h1>")).toBe(false);
  });
});

describe("isDemoFile", () => {
  it("só extensões aceitas, sem ocultos nem node_modules", () => {
    expect(isDemoFile("index.html")).toBe(true);
    expect(isDemoFile("assets/app.JS")).toBe(true);
    expect(isDemoFile("src/main.tsx")).toBe(false);
    expect(isDemoFile(".github/x.yml")).toBe(false);
    expect(isDemoFile("a/.env")).toBe(false);
    expect(isDemoFile("node_modules/x/index.js")).toBe(false);
    expect(isDemoFile("LICENSE")).toBe(false);
  });
});

describe("findSiteSource", () => {
  it("usa a branch gh-pages quando existe", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes("/git/trees/gh-pages")) return json(200, tree(blob("index.html"), blob("app.js", 20), blob("CNAME")));
      if (url.startsWith("https://raw.githubusercontent.com/")) return new Response("<h1>ok</h1>");
      return json(404, {});
    });
    expect(await findSiteSource(repo, fetchFn)).toEqual({
      kind: "found",
      source: { ref: "gh-pages", folder: "", files: [{ path: "index.html", size: 10 }, { path: "app.js", size: 20 }] },
    });
    expect(fetchFn).toHaveBeenCalledWith("https://raw.githubusercontent.com/ana/kanban/gh-pages/index.html", undefined);
  });

  it("sem gh-pages, procura na branch padrão", async () => {
    const fetchFn = async (url: string) => {
      if (url.includes("/git/trees/main")) return json(200, tree(blob("README.md"), blob("dist/index.html"), blob("dist/a.css"), blob("src/main.tsx"), { path: "dist", type: "tree" }));
      if (url.startsWith("https://raw")) return new Response("<link href=a.css>");
      return json(404, {});
    };
    const r = await findSiteSource(repo, fetchFn);
    expect(r).toEqual({ kind: "found", source: { ref: "main", folder: "dist/", files: [{ path: "dist/index.html", size: 10 }, { path: "dist/a.css", size: 10 }] } });
  });

  it("gh-pages que precisa de build ainda tenta a pasta dist da branch padrão", async () => {
    const fetchFn = async (url: string) => {
      if (url.includes("/git/trees/gh-pages")) return json(200, tree(blob("index.html")));
      if (url.includes("/git/trees/main")) return json(200, tree(blob("dist/index.html")));
      if (url.endsWith("/gh-pages/index.html")) return new Response('<script src="/src/main.tsx"></script>');
      return new Response("<h1>ok</h1>");
    };
    expect(await findSiteSource(repo, fetchFn)).toMatchObject({ kind: "found", source: { ref: "main", folder: "dist/" } });
  });

  it("branch com barra vai sem codificar a barra", async () => {
    const fetchFn = vi.fn(async () => json(404, {}));
    await findSiteSource({ ...repo, defaultBranch: "feat/x" }, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith("https://api.github.com/repos/ana/kanban/git/trees/feat/x?recursive=1", expect.anything());
  });

  it("projeto que precisa de build", async () => {
    const fetchFn = async (url: string) => {
      if (url.includes("/git/trees/main")) return json(200, tree(blob("index.html"), blob("src/main.tsx")));
      if (url.startsWith("https://raw")) return new Response('<script type="module" src="/src/main.tsx"></script>');
      return json(404, {});
    };
    expect(await findSiteSource(repo, fetchFn)).toEqual({ kind: "needs_build" });
  });

  it("sem index.html mas com package.json (Next, por exemplo) precisa de build", async () => {
    const fetchFn = async (url: string) =>
      url.includes("/git/trees/main") ? json(200, tree(blob("package.json"), blob("app/page.tsx"))) : json(404, {});
    expect(await findSiteSource(repo, fetchFn)).toEqual({ kind: "needs_build" });
  });

  it("sem index.html em lugar nenhum", async () => {
    const fetchFn = async (url: string) => (url.includes("/git/trees/main") ? json(200, tree(blob("main.py"))) : json(404, {}));
    expect(await findSiteSource(repo, fetchFn)).toEqual({ kind: "none" });
  });

  it("grande demais", async () => {
    const big = async (url: string) => (url.includes("/git/trees/main") ? json(200, tree(blob("index.html", 61 * 1024 * 1024))) : json(404, {}));
    expect(await findSiteSource(repo, big)).toEqual({ kind: "too_big" });
    const many = async (url: string) =>
      url.includes("/git/trees/main") ? json(200, tree(blob("index.html"), ...Array.from({ length: 500 }, (_, i) => blob(`f${i}.js`)))) : json(404, {});
    expect(await findSiteSource(repo, many)).toEqual({ kind: "too_big" });
    const truncated = async (url: string) => (url.includes("/git/trees/main") ? json(200, { truncated: true, tree: [blob("index.html")] }) : json(404, {}));
    expect(await findSiteSource(repo, truncated)).toEqual({ kind: "too_big" });
  });
});

describe("buildDemoZip", () => {
  it("baixa os arquivos e monta o zip com caminhos relativos à pasta", async () => {
    const fetchFn = vi.fn(async (url: string) => new Response(url.endsWith("index.html") ? "<h1>oi</h1>" : "body{}"));
    const file = await buildDemoZip(repo, { ref: "main", folder: "dist/", files: [{ path: "dist/index.html", size: 1 }, { path: "dist/css/a b.css", size: 1 }] }, fetchFn);
    expect(file.name).toBe("kanban.zip");
    expect(fetchFn).toHaveBeenCalledWith("https://raw.githubusercontent.com/ana/kanban/main/dist/css/a%20b.css", undefined);
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(["css/a b.css", "index.html"]);
    expect(strFromU8(files["index.html"])).toBe("<h1>oi</h1>");
  });

  it("falha de download vira erro de rede", async () => {
    await expect(buildDemoZip(repo, { ref: "main", folder: "", files: [{ path: "index.html", size: 1 }] }, async () => new Response("", { status: 500 }))).rejects.toMatchObject({ code: "network" });
  });
});
