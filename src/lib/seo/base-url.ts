type Env = Partial<Record<"NEXT_PUBLIC_SITE_URL" | "VERCEL_PROJECT_PRODUCTION_URL", string>>;

function parse(raw: string | undefined): URL | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? new URL(url.origin) : null;
  } catch {
    return null;
  }
}

/**
 * Endereço público do site para metadados, sitemap e links canônicos (não
 * depende do pedido, então serve em páginas estáticas). Ordem: NEXT_PUBLIC_SITE_URL,
 * o domínio de produção que a Vercel informa no build, localhost.
 */
export function publicBaseUrl(env: Env = process.env as Env): URL {
  return (
    parse(env.NEXT_PUBLIC_SITE_URL) ??
    parse(env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ??
    new URL("http://localhost:3000")
  );
}
