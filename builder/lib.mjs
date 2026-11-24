// Funções puras do compilador de demos (sem dependências: roda com o Node do runner).
// Design: docs/superpowers/specs/2026-11-24-devsync-build-de-demos-design.md
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";

/** Mesmos limites do serviço de demos (workers/demos/src/zip.ts). */
export const MAX_FILES = 500;
export const MAX_BYTES = 60 * 1024 * 1024;
export const MAX_ZIP_BYTES = 25 * 1024 * 1024;

/** Cópia das extensões aceitas pelo serviço de demos (workers/demos/src/content-types.ts). */
const EXTENSIONS = new Set(
  "html htm css js mjs cjs json map webmanifest txt md csv xml wasm svg png jpg jpeg gif webp avif ico bmp woff woff2 ttf otf eot mp3 wav ogg m4a mp4 webm glb gltf bin pdf".split(" "),
);

export function isDemoFile(path) {
  const parts = path.split("/");
  if (parts.some((p) => p.startsWith(".") || p === "node_modules")) return false;
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf(".");
  return dot > 0 && EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9._][A-Za-z0-9._/-]{0,254}$/;
const API = /^https:\/\/[a-z0-9.-]+(:\d+)?$/;

/** Entradas do workflow (vêm por variável de ambiente, nunca interpoladas num script). */
export function validateInputs(env) {
  const { BUILD_ID: buildId, REPO: repo, REF: ref, API: api } = env;
  if (!UUID.test(buildId ?? "")) return null;
  if (!REPO.test(repo ?? "") || repo.split("/")[1].startsWith(".")) return null;
  if (!REF.test(ref ?? "") || ref.includes("..")) return null;
  if (!API.test(api ?? "")) return null;
  return { buildId, repo, ref, api };
}

// `public` e `docs` costumam ser modelos/fonte (CRA, Vite): só entram pelo framework (Gatsby).
const GENERIC_OUTPUTS = ["dist", "build", "out", ".output/public"];

const FRAMEWORKS = [
  { dep: "next", name: "next", outputs: ["out"] },
  { dep: "nuxt", name: "nuxt", outputs: [".output/public", "dist"] },
  { dep: "@sveltejs/kit", name: "sveltekit", outputs: ["build"] },
  { dep: "astro", name: "astro", outputs: ["dist"] },
  { dep: "@angular/core", name: "angular", outputs: ["dist"] },
  { dep: "gatsby", name: "gatsby", outputs: ["public"] },
  { dep: "react-scripts", name: "create-react-app", outputs: ["build"], env: { PUBLIC_URL: "/" } },
  { dep: "@vue/cli-service", name: "vue-cli", outputs: ["dist"] },
  { dep: "vite", name: "vite", outputs: ["dist"] },
  { dep: "parcel", name: "parcel", outputs: ["dist"] },
];

/** Decide como instalar e compilar a partir do package.json e dos arquivos da raiz. */
export function planBuild(pkg, has) {
  if (!pkg) return { error: "no_package_json" };
  const script = pkg.scripts?.build;
  if (typeof script !== "string" || !script.trim()) return { error: "no_build_script" };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const fw = FRAMEWORKS.find((f) => f.dep in deps);

  // O campo packageManager manda (o corepack recusa outro gerenciador); senão, o lockfile.
  const declared = /^(npm|pnpm|yarn)@/.exec(typeof pkg.packageManager === "string" ? pkg.packageManager : "")?.[1];
  let packageManager = declared ?? "npm";
  if (!declared && has("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (!declared && has("yarn.lock")) packageManager = "yarn";

  const install = {
    npm: has("package-lock.json") ? "npm ci --no-audit --no-fund || npm install --no-audit --no-fund" : "npm install --no-audit --no-fund",
    pnpm: "corepack pnpm install --no-frozen-lockfile",
    yarn: "corepack yarn install",
  }[packageManager];
  let build = { npm: "npm run build", pnpm: "corepack pnpm run build", yarn: "corepack yarn run build" }[packageManager];
  // A demo roda na raiz do subdomínio: um `base` de GitHub Pages quebraria os caminhos.
  if (fw?.name === "vite" && /(^|&&\s*|;\s*)vite build\s*$/.test(script.trim())) {
    build += packageManager === "npm" ? " -- --base=/" : " --base=/";
  }
  const outputs = [...new Set([...(fw?.outputs ?? []), ...GENERIC_OUTPUTS])];
  return { packageManager, framework: fw?.name ?? "node", install, build, outputs, env: fw?.env ?? {} };
}

function isDir(p) {
  try {
    const s = lstatSync(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}
const hasIndex = (p) => {
  try {
    return lstatSync(join(p, "index.html")).isFile();
  } catch {
    return false;
  }
};

/** Primeira pasta de saída com index.html (ela, um nível abaixo, ou <sub>/browser como no Angular). */
export function findOutput(root, candidates) {
  const base = realpathSync(root) + "/";
  // Nada de link no caminho: a pasta tem de estar de verdade dentro do projeto.
  const inside = (rel) => {
    try {
      return realpathSync(join(root, rel)) + "/" === base + rel + "/";
    } catch {
      return false;
    }
  };
  for (const c of candidates) {
    const dir = join(root, c);
    if (!isDir(dir)) continue;
    if (!inside(c)) continue;
    if (hasIndex(dir)) return c;
    for (const sub of readdirSync(dir).sort()) {
      if (!isDir(join(dir, sub))) continue;
      if (hasIndex(join(dir, sub))) return `${c}/${sub}`;
      if (inside(`${c}/${sub}/browser`) && hasIndex(join(dir, sub, "browser"))) return `${c}/${sub}/browser`;
    }
  }
  return null;
}

/** Arquivos que vão para o zip: só arquivos comuns, extensões aceitas, sem ocultos nem links. */
export function collectFiles(dir) {
  const files = [];
  let bytes = 0;
  const walk = (rel) => {
    for (const name of readdirSync(join(dir, rel))) {
      const path = rel ? `${rel}/${name}` : name;
      const st = lstatSync(join(dir, path));
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (!name.startsWith(".") && name !== "node_modules") walk(path);
        continue;
      }
      if (!st.isFile() || !isDemoFile(path)) continue;
      files.push(path);
      bytes += st.size;
      if (files.length > MAX_FILES) throw new LimitError("too_many_files");
      if (bytes > MAX_BYTES) throw new LimitError("too_big");
    }
  };
  try {
    walk("");
  } catch (e) {
    if (e instanceof LimitError) return { error: e.code };
    throw e;
  }
  return { files, bytes };
}

class LimitError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Últimas linhas do log, sem códigos de cor. */
export function tailLog(text, lines = 80) {
  const clean = text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r/g, "");
  return clean.split("\n").filter((l, i, a) => l !== "" || i < a.length - 1).slice(-lines).join("\n");
}

