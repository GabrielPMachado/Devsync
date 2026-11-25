"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Hidden } from "@/lib/moderation/catalog";

type CatalogAvailability = { hidden: Hidden; grantedFrames: readonly string[] };

const EMPTY: CatalogAvailability = { hidden: { banner: [], accent: [], frame: [], badge: [] }, grantedFrames: [] };
const Ctx = createContext<CatalogAvailability>(EMPTY);

/** Itens que a moderação desligou (somem do editor) e bordas liberadas à mão para a pessoa. */
export function CatalogProvider({ hidden, grantedFrames, children }: CatalogAvailability & { children: ReactNode }) {
  return <Ctx value={{ hidden, grantedFrames }}>{children}</Ctx>;
}

/** Sem provedor, tudo aparece (é o catálogo do código). */
export function useCatalog(): CatalogAvailability {
  return useContext(Ctx);
}
