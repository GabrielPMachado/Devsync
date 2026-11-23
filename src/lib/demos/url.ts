export type DemoKind = "web_link" | "web_upload" | "sandbox" | "mobile";
export type DemoStatus = "pending" | "live" | "blocked" | "unavailable";

/** Maior .zip aceito pelo serviço de demos. */
export const ZIP_MAX_BYTES = 25 * 1024 * 1024;

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

/** Endereço que vai no iframe: `<id>.<host>` para zip, a própria URL para link. */
export function demoFrameSrc(demo: { id: string; kind: DemoKind; url: string | null }, base: URL | null): string | null {
  if (demo.kind === "web_link") return demo.url;
  if (demo.kind === "web_upload" && base) return `${base.protocol}//${demo.id}.${base.host}/`;
  return null;
}
