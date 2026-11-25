// Compila a demo de um repositório público e envia ao serviço de demos da Devsync.
// Roda no runner do GitHub Actions (workflow build-demo.yml). O código do autor só
// roda dentro de um container Docker sem segredos: o token OIDC fica aqui fora.
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { collectFiles, findOutput, MAX_ZIP_BYTES, planBuild, tailLog, validateInputs } from "./lib.mjs";

const IMAGE = "node:22-bookworm";
const CONTAINER = "devsync-build";
const INSTALL_TIMEOUT_MS = 6 * 60_000;
const BUILD_TIMEOUT_MS = 8 * 60_000;
const AUDIENCE = "devsync-builds";

const inputs = validateInputs(process.env);
if (!inputs) {
  console.error("Entradas inválidas");
  // Com o ID e o endereço válidos, ainda dá para encerrar o build (senão ele fica parado).
  const partial = validateInputs({ ...process.env, REPO: "x/x", REF: "main" });
  if (partial) {
    const tok = await oidcToken().catch(() => null);
    if (tok) {
      await fetch(`${partial.api}/builds/${partial.buildId}/progress`, {
        method: "POST",
        headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" },
        body: JSON.stringify({ stage: "failed", error: "invalid_input" }),
      }).catch(() => {});
    }
  }
  process.exit(1);
}
const work = process.env.RUNNER_TEMP ?? "/tmp";
const src = join(work, "src");
const zipPath = join(work, "demo.zip");

/** Ambiente mínimo para processos filhos: nada de ACTIONS_* nem GITHUB_TOKEN. */
const cleanEnv = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8", GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1" };

async function oidcToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !token) throw new Error("Sem permissão id-token: write no workflow");
  const res = await fetch(`${url}&audience=${AUDIENCE}`, { headers: { authorization: `bearer ${token}` } });
  if (!res.ok) throw new Error(`OIDC respondeu ${res.status}`);
  return (await res.json()).value;
}

async function callApi(path, init) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${inputs.api}/builds/${inputs.buildId}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${await oidcToken()}` },
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (res.ok) return;
    // 4xx é definitivo (token, ordem, build encerrado); erro de rede ou 5xx tenta de novo.
    if ((res.status >= 400 && res.status < 500) || attempt >= 3) {
      throw new Error(`Serviço de demos respondeu ${res.status}: ${await res.text()}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }
}

const report = (stage, extra = {}) =>
  callApi("/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage, ...extra }) });

class BuildError extends Error {
  constructor(code, log = "") {
    super(code);
    this.code = code;
    this.log = log;
  }
}

/** Roda um comando e devolve a saída (stdout + stderr). Mata ao passar do tempo. */
function run(cmd, args, { timeoutMs = 10 * 60_000, onTimeout, cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: cleanEnv, cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const add = (d) => {
      process.stdout.write(d);
      out = (out + d.toString()).slice(-200_000);
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      onTimeout?.();
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out, timedOut });
    });
  });
}

/** Comando dentro do container: usuário sem root, sem capacidades, com limites. */
function inContainer(script, env, timeoutMs) {
  const uid = process.getuid?.() ?? 1001;
  const gid = process.getgid?.() ?? 1001;
  const envArgs = Object.entries({
    HOME: "/tmp/home",
    COREPACK_HOME: "/tmp/corepack",
    COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
    npm_config_cache: "/tmp/npm",
    NEXT_TELEMETRY_DISABLED: "1",
    ASTRO_TELEMETRY_DISABLED: "1",
    NODE_OPTIONS: "--max-old-space-size=4096",
    ...env,
  }).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  return run(
    "docker",
    [
      "run", "--rm", "--name", CONTAINER,
      "--user", `${uid}:${gid}`,
      "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--memory", "6g", "--memory-swap", "6g", "--cpus", "2", "--pids-limit", "4096",
      "-v", `${src}:/app`, "-w", "/app",
      ...envArgs,
      IMAGE, "sh", "-c", `mkdir -p "$HOME" && ${script}`,
    ],
    { timeoutMs, onTimeout: () => spawn("docker", ["kill", CONTAINER], { env: cleanEnv }) },
  );
}

async function main() {
  // A saída do build é de terceiros: o runner não pode interpretar linhas "::comando::" dela.
  console.log(`::stop-commands::${randomUUID()}`);
  await report("cloning");
  const clone = await run("git", [
    "-c", "core.hooksPath=/dev/null", "-c", "protocol.file.allow=never",
    "clone", "--depth", "1", "--single-branch", "--no-tags", "--branch", inputs.ref,
    `https://github.com/${inputs.repo}.git`, src,
  ], { timeoutMs: 3 * 60_000 });
  if (clone.code !== 0) throw new BuildError("clone_failed", clone.out);

  const pkgPath = join(src, "package.json");
  let pkg = null;
  if (existsSync(pkgPath) && statSync(pkgPath).isFile() && statSync(pkgPath).size < 1_000_000) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      throw new BuildError("no_package_json", "package.json inválido");
    }
  }
  const plan = planBuild(pkg, (f) => existsSync(join(src, f)));
  if (plan.error) throw new BuildError(plan.error);
  console.log(`Plano: ${JSON.stringify(plan)}`);
  const pull = await run("docker", ["pull", "-q", IMAGE], { timeoutMs: 3 * 60_000 });
  if (pull.code !== 0) throw new BuildError("internal", pull.out);

  await report("installing", { framework: plan.framework });
  const install = await inContainer(plan.install, { CI: "true" }, INSTALL_TIMEOUT_MS);
  if (install.timedOut) throw new BuildError("install_timeout", install.out);
  if (install.code !== 0) throw new BuildError("install_failed", install.out);

  await report("building");
  const build = await inContainer(plan.build, plan.env, BUILD_TIMEOUT_MS);
  if (build.timedOut) throw new BuildError("build_timeout", build.out);
  if (build.code !== 0) throw new BuildError("build_failed", build.out);

  const out = findOutput(src, plan.outputs);
  if (!out) throw new BuildError(plan.framework === "next" ? "next_server" : "no_output", build.out);
  const outDir = join(src, out);
  const files = collectFiles(outDir);
  if (files.error) throw new BuildError(files.error);
  console.log(`Saída: ${out} (${files.files.length} arquivos, ${files.bytes} bytes)`);

  await report("uploading");
  if (realpathSync(outDir) !== join(realpathSync(src), out)) throw new BuildError("no_output");
  // -y: link entra como link (e o serviço de demos recusa), nunca como o arquivo de fora.
  const zip = spawn("zip", ["-q", "-0", "-X", "-D", "-y", zipPath, "-@"], { cwd: outDir, env: cleanEnv, stdio: ["pipe", "inherit", "inherit"] });
  zip.stdin.end(files.files.join("\n") + "\n");
  const zipCode = await new Promise((r) => zip.on("close", r));
  if (zipCode !== 0) throw new BuildError("internal", "zip falhou");
  const size = statSync(zipPath).size;
  if (size > MAX_ZIP_BYTES) throw new BuildError("too_big");
  await callApi("/zip", {
    method: "PUT",
    headers: { "content-type": "application/zip", "content-length": String(size) },
    body: readFileSync(zipPath),
  }).catch((e) => {
    throw new BuildError("upload_failed", String(e.message ?? e));
  });
  console.log("Enviado. A validação segue no serviço de demos.");
}

mkdirSync(work, { recursive: true });
main().catch(async (err) => {
  const code = err instanceof BuildError ? err.code : "internal";
  console.error(`Build falhou: ${code}`, err instanceof BuildError ? "" : err);
  try {
    await report("failed", { error: code, log: tailLog(err.log ?? "", 80) });
  } catch (e) {
    console.error("Não deu para avisar a falha", e);
  }
  process.exit(1);
});
