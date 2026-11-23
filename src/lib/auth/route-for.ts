import { safeNext } from "./safe-next";

/**
 * auth: /entrar · onboarding: /boas-vindas · app: páginas abertas a visitantes ·
 * private: páginas do app que exigem login.
 */
export type RouteArea = "auth" | "onboarding" | "app" | "private";

/** Para onde mandar a pessoa, ou null se ela pode ficar onde está. */
export function routeFor(
  area: RouteArea,
  viewer: { username: string | null } | null,
  next?: string,
): string | null {
  if (!viewer) {
    if (area === "private") return `/entrar?next=${encodeURIComponent(safeNext(next))}`;
    if (area === "onboarding") return `/entrar?next=${encodeURIComponent("/boas-vindas")}`;
    return null;
  }
  if (!viewer.username) return area === "onboarding" ? null : "/boas-vindas";
  if (area === "auth" || area === "onboarding") return safeNext(next);
  return null;
}
