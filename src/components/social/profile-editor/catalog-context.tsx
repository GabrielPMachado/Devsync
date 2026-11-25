"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Hidden } from "@/lib/moderation/catalog";

type Granted = Record<"banner" | "accent" | "frame", readonly string[]>;
type CatalogAvailability = { hidden: Hidden; granted: Granted };

const EMPTY: CatalogAvailability = { hidden: { banner: [], accent: [], frame: [], badge: [] }, granted: { banner: [], accent: [], frame: [] } };
const Ctx = createContext<CatalogAvailability>(EMPTY);

/** Itens que a moderação desligou (somem do editor) e os liberados à mão para a pessoa. */
export function CatalogProvider({ hidden, granted, children }: CatalogAvailability & { children: ReactNode }) {
  return <Ctx value={{ hidden, granted }}>{children}</Ctx>;
}

/** Sem provedor, tudo aparece (é o catálogo do código). */
export function useCatalog(): CatalogAvailability {
  return useContext(Ctx);
}
