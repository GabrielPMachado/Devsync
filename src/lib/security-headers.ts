/**
 * Cabeçalhos de segurança do site (aplicados em next.config.ts para todas as rotas).
 *
 * script-src tem 'unsafe-inline' porque o Next coloca scripts inline nas páginas
 * pré-renderizadas; nonce exigiria renderizar tudo por pedido. O resto da política
 * fecha o que importa: nada de embutir a Devsync (frame-ancestors), nada de
 * plugins, e conexões só para o Supabase e o serviço de demos.
 */
export type SecurityEnv = {
  supabaseUrl?: string;
  demosUrl?: string;
  dev: boolean;
};

type Header = { key: string; value: string };

function origin(raw: string | undefined): URL | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ supabaseUrl, demosUrl, dev }: SecurityEnv): string {
  const supabase = origin(supabaseUrl);
  const demos = origin(demosUrl);

  // API pública do GitHub: importar projeto lê os repositórios direto do navegador.
  const connect = ["'self'", "https://api.github.com"];
  const frame = ["'self'", "https:"]; // demos por link podem estar em qualquer site https
  const formAction = ["'self'", "https://github.com"];

  if (supabase) {
    const ws = supabase.protocol === "https:" ? "wss:" : "ws:";
    connect.push(supabase.origin, `${ws}//${supabase.host}`);
    formAction.push(supabase.origin);
  }
  if (demos) {
    connect.push(demos.origin);
    // Cada demo enviada fica em <id>.<host do serviço de demos>.
    frame.push(`${demos.protocol}//*.${demos.host}`);
  }
  if (dev) connect.push("ws:"); // recarregamento do next dev
  // Supabase local e Worker local (E2E com next start) falam http.
  const local = dev || supabase?.protocol === "http:" || demos?.protocol === "http:";

  const script = ["'self'", "'unsafe-inline'"];
  if (dev) script.push("'unsafe-eval'");

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", script],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", "https:", ...(local ? ["http:"] : [])]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connect],
    ["frame-src", frame],
    ["worker-src", ["'self'"]],
    ["manifest-src", ["'self'"]],
    ["media-src", ["'self'", "https:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", formAction],
    ["frame-ancestors", ["'none'"]],
  ];
  if (!local) directives.push(["upgrade-insecure-requests", []]);

  return directives.map(([name, values]) => [name, ...values].join(" ")).join("; ");
}

export function securityHeaders(env: SecurityEnv): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
