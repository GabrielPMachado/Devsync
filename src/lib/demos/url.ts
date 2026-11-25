export type DemoKind = "web_link" | "web_upload" | "sandbox" | "mobile";
export type DemoStatus = "pending" | "live" | "blocked" | "unavailable";

/** Maior .zip aceito pelo serviço de demos (já sem compressão: 60 MB de arquivos + cabeçalhos). */
export const ZIP_MAX_BYTES = 64 * 1024 * 1024;

/**
 * Endereço do serviço de demos (workers/demos). A API fica nele e cada demo
 * enviada num subdomínio próprio. Local: http://demos.localhost:8787
 */
export function demosBaseUrl(raw: string | undefined = process.env.NEXT_PUBLIC_DEMOS_URL): URL | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export type DemosMode = "subdomain" | "path";

/**
 * Como as demos enviadas são servidas. "path" (`<host>/d/<id>/`) é o do workers.dev
 * grátis, que não aceita um subdomínio por demo. "subdomain" (`<id>.<host>`) é o de
 * domínio próprio. NEXT_PUBLIC_DEMOS_MODE força um dos dois.
 */
export function demosMode(base: URL | null, raw: string | undefined = process.env.NEXT_PUBLIC_DEMOS_MODE): DemosMode {
  const forced = raw?.trim();
  if (forced === "path" || forced === "subdomain") return forced;
  return base?.hostname.endsWith(".workers.dev") ? "path" : "subdomain";
}

/** Endereço que vai no iframe: `<id>.<host>` (ou `<host>/d/<id>/`) para zip, a própria URL para link. */
export function demoFrameSrc(
  demo: { id: string; kind: DemoKind; url: string | null },
  base: URL | null,
  mode: DemosMode = demosMode(base),
): string | null {
  if (demo.kind === "web_link") return demo.url;
  if (demo.kind !== "web_upload" || !base) return null;
  return mode === "path" ? `${base.origin}/d/${demo.id}/` : `${base.protocol}//${demo.id}.${base.host}/`;
}
