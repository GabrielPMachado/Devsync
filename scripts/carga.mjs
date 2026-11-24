#!/usr/bin/env node
// Teste de carga leve: N conexões simultâneas pedindo páginas públicas por alguns
// segundos. Falha (código 1) se mais de 1% der erro ou se o p95 passar do limite.
//
// Uso: node scripts/carga.mjs [baseURL] [--conexoes 20] [--segundos 20] [--p95 1500]
// Ex.:  node scripts/carga.mjs http://localhost:3100
//
// Não rode contra produção sem combinar: o Supabase grátis tem limite de uso.

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "http://localhost:3100").replace(/\/+$/, "");
const connections = opt("conexoes", 20);
const seconds = opt("segundos", 20);
const p95Limit = opt("p95", 1500);
const paths = ["/", "/projetos", "/estudos", "/sitemap.xml", "/manifest.webmanifest"];

const times = [];
const errors = new Map();
const byPath = new Map(paths.map((p) => [p, []]));
const deadline = Date.now() + seconds * 1000;

async function worker(id) {
  let i = id;
  while (Date.now() < deadline) {
    const path = paths[i++ % paths.length];
    const start = performance.now();
    try {
      const res = await fetch(base + path, { redirect: "manual", headers: { "user-agent": "devsync-carga" } });
      await res.arrayBuffer();
      const ms = performance.now() - start;
      if (res.status >= 400) errors.set(`${path} ${res.status}`, (errors.get(`${path} ${res.status}`) ?? 0) + 1);
      times.push(ms);
      byPath.get(path).push(ms);
    } catch (err) {
      errors.set(`${path} ${err.cause?.code ?? err.message}`, (errors.get(`${path} ${err.cause?.code ?? err.message}`) ?? 0) + 1);
    }
  }
}

const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

console.log(`Carga leve em ${base}: ${connections} conexões por ${seconds}s`);
await Promise.all(Array.from({ length: connections }, (_, i) => worker(i)));

// times tem todo pedido que voltou (inclusive 4xx/5xx); falha de rede só conta em errors.
const networkErrors = [...errors].filter(([k]) => !/\s\d{3}$/.test(k)).reduce((a, [, n]) => a + n, 0);
const total = times.length + networkErrors;
const errorCount = [...errors.values()].reduce((a, b) => a + b, 0);
const errorRate = total ? errorCount / total : 1;
const p95 = pct(times, 95);

console.log(`Pedidos: ${total} (${(total / seconds).toFixed(1)}/s), erros: ${errorCount} (${(errorRate * 100).toFixed(2)}%)`);
console.log(`Tempo: p50 ${pct(times, 50).toFixed(0)} ms, p95 ${p95.toFixed(0)} ms, p99 ${pct(times, 99).toFixed(0)} ms`);
for (const [path, arr] of byPath) console.log(`  ${path.padEnd(22)} ${String(arr.length).padStart(5)} pedidos, p95 ${pct(arr, 95).toFixed(0)} ms`);
for (const [k, n] of errors) console.log(`  erro ${k}: ${n}`);

const ok = errorRate <= 0.01 && p95 <= p95Limit;
console.log(ok ? "OK" : `FALHOU (limite: até 1% de erro e p95 até ${p95Limit} ms)`);
process.exit(ok ? 0 : 1);
