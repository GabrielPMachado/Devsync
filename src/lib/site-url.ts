import "server-only";
import { headers } from "next/headers";

/**
 * Origem pública do site para montar os links de retorno do login.
 * Em produção vem de NEXT_PUBLIC_SITE_URL; sem ela, da origem do pedido.
 */
export async function siteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
