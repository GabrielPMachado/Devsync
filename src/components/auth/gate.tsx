import { redirect } from "next/navigation";
import { routeFor, type RouteArea } from "@/lib/auth/route-for";
import { getViewer } from "@/lib/auth/viewer";

/**
 * Manda a pessoa para onde ela deve estar (entrar, boas-vindas...). Lê a
 * sessão, então sempre vai dentro de um <Suspense> (Cache Components).
 */
export async function Gate({ area, next }: { area: RouteArea; next?: string }) {
  const go = routeFor(area, await getViewer(), next);
  if (go) redirect(go);
  return null;
}
