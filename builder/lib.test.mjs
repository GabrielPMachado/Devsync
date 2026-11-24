// @vitest-environment node
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectFiles, findOutput, isDemoFile, planBuild, tailLog, validateInputs } from "./lib.mjs";

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "build-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

describe("validateInputs", () => {
  const ok = { BUILD_ID: "3f1c1d6e-0b7a-4d3c-9a43-0c1f2e3d4b5a", REPO: "ana/financy", REF: "main", API: "https://demos.devsync.app" };
  it("aceita entradas válidas", () => expect(validateInputs(ok)).toEqual({ buildId: ok.BUILD_ID, repo: "ana/financy", ref: "main", api: ok.API }));
  it.each([
    ["BUILD_ID", "x"],
    ["REPO", "ana/x; rm -rf /"],
    ["REPO", "ana/.git"],
    ["REF", "--upload-pack=x"],
    ["REF", "a/../b"],
    ["API", "http://demos.devsync.app"],
    ["API", "https://demos.devsync.app/x?y"],
  ])("recusa %s = %s", (key, value) => expect(validateInputs({ ...ok, [key]: value })).toBeNull());
});

describe("planBuild", () => {
  const files = (list) => (p) => list.includes(p);
  it("sem package.json ou sem script build é erro", () => {
    expect(planBuild(null, files([]))).toEqual({ error: "no_package_json" });
    expect(planBuild({ scripts: { dev: "vite" } }, files(["package.json"]))).toEqual({ error: "no_build_script" });
  });

  it("Vite com npm: npm ci e base na raiz", () => {
    const plan = planBuild({ scripts: { build: "tsc -b && vite build" }, devDependencies: { vite: "^6" } }, files(["package-lock.json"]));
    expect(plan.framework).toBe("vite");
    expect(plan.install).toBe("npm ci --no-audit --no-fund || npm install --no-audit --no-fund");
    expect(plan.build).toBe("npm run build -- --base=/");
    expect(plan.outputs[0]).toBe("dist");
  });

  it("Vite com script que não termina em vite build não ganha --base", () => {
    const plan = planBuild({ scripts: { build: "vite build && node post.js" }, dependencies: { vite: "6" } }, files([]));
    expect(plan.build).toBe("npm run build");
    expect(plan.install).toBe("npm install --no-audit --no-fund");
  });

  it("pnpm e yarn pelo lockfile", () => {
    const pkg = { scripts: { build: "vite build" }, devDependencies: { vite: "6" } };
    expect(planBuild(pkg, files(["pnpm-lock.yaml"]))).toMatchObject({
      packageManager: "pnpm",
      install: "corepack pnpm install --no-frozen-lockfile",
      build: "corepack pnpm run build --base=/",
    });
    expect(planBuild(pkg, files(["yarn.lock"]))).toMatchObject({
      packageManager: "yarn",
      install: "corepack yarn install",
      build: "corepack yarn run build --base=/",
    });
  });

  it("o campo packageManager manda mais que o lockfile", () => {
    const pkg = { packageManager: "yarn@4.5.0", scripts: { build: "tsc" } };
    expect(planBuild(pkg, files(["pnpm-lock.yaml"]))).toMatchObject({ packageManager: "yarn", install: "corepack yarn install" });
    expect(planBuild({ ...pkg, packageManager: "pnpm@9.1.0" }, files(["yarn.lock"]))).toMatchObject({ packageManager: "pnpm" });
  });

  it("public só vale para Gatsby (em outros é a pasta de modelos)", () => {
    expect(planBuild({ scripts: { build: "react-scripts build" }, dependencies: { "react-scripts": "5" } }, files([])).outputs).not.toContain("public");
    expect(planBuild({ scripts: { build: "gatsby build" }, dependencies: { gatsby: "5" } }, files([])).outputs).toContain("public");
  });

  it("CRA usa a pasta build e PUBLIC_URL na raiz", () => {
    const plan = planBuild({ scripts: { build: "react-scripts build" }, dependencies: { "react-scripts": "5" } }, files([]));
    expect(plan).toMatchObject({ framework: "create-react-app", env: { PUBLIC_URL: "/" } });
    expect(plan.outputs[0]).toBe("build");
  });

  it("Next usa out", () => {
    const plan = planBuild({ scripts: { build: "next build" }, dependencies: { next: "15", react: "19" } }, files([]));
    expect(plan.framework).toBe("next");
    expect(plan.outputs[0]).toBe("out");
  });
});

describe("findOutput", () => {
  it("acha a primeira pasta com index.html, inclusive um nível abaixo (Angular)", () => {
    const root = tree({ "public/index.html": "x", "dist/app/browser/index.html": "x" });
    expect(findOutput(root, ["dist", "build", "public"])).toBe("dist/app/browser");
  });

  it("ignora pasta de saída que é link para fora do projeto", () => {
    const fora = tree({ "index.html": "segredo" });
    const root = tree({ "src/x.js": "1" });
    symlinkSync(fora, join(root, "dist"));
    mkdirSync(join(root, "build"));
    symlinkSync(fora, join(root, "build", "app"));
    expect(findOutput(root, ["dist", "build"])).toBeNull();
    expect(findOutput(tree({ "build/index.html": "x" }), ["dist", "build"])).toBe("build");
    expect(findOutput(tree({ "src/index.html": "x" }), ["dist", "build"])).toBeNull();
  });
});

describe("collectFiles", () => {
  it("filtra extensões, ocultos e links simbólicos", () => {
    const root = tree({ "index.html": "<h1>", "assets/app.js": "1", "assets/.env": "SEGREDO", "notas.sh": "x", ".git/config": "x" });
    symlinkSync("/etc/passwd", join(root, "passwd.txt"));
    const res = collectFiles(root);
    expect(res.files.sort()).toEqual(["assets/app.js", "index.html"]);
  });

  it("recusa mais de 500 arquivos e mais de 60 MB", () => {
    const many = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`f${i}.js`, "1"]));
    expect(collectFiles(tree({ "index.html": "x", ...many }))).toEqual({ error: "too_many_files" });
    const big = tree({ "index.html": "x" });
    writeFileSync(join(big, "video.mp4"), Buffer.alloc(61 * 1024 * 1024));
    expect(collectFiles(big)).toEqual({ error: "too_big" });
  });
});

describe("isDemoFile e tailLog", () => {
  it("mesmas extensões do serviço de demos", () => {
    expect(isDemoFile("a/b.woff2")).toBe(true);
    expect(isDemoFile("a/b.php")).toBe(false);
    expect(isDemoFile("node_modules/x.js")).toBe(false);
  });
  it("tira cores e guarda o fim do log", () => {
    const log = Array.from({ length: 200 }, (_, i) => `\u001b[31mlinha ${i}\u001b[0m`).join("\n");
    const tail = tailLog(log, 3);
    expect(tail).toBe("linha 197\nlinha 198\nlinha 199");
  });
});
