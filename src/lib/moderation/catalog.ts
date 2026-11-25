/**
 * Estado do catálogo de personalização (ligado/desligado e nome trocado pela moderação).
 * O desenho dos itens continua no código; o banco (catalog_item_state) só guarda o que mudou:
 * sem linha = ligado e com o nome de messages/*.json.
 */

import { BADGE_KEYS } from "@/lib/social/badges";
import { ACCENTS, BANNER_PRESETS, FRAMES } from "@/lib/social/profile-style";

/** Etiqueta do cache do estado do catálogo (as ações do /admin limpam). */
export const CATALOG_TAG = "catalog-state";

export const CATALOG_KINDS = ["banner", "accent", "frame", "badge"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];
export type GrantKind = Exclude<CatalogKind, "badge">;
export const GRANT_KINDS: readonly GrantKind[] = ["banner", "accent", "frame"];

export type CatalogRow = { kind: CatalogKind; key: string; active: boolean; label: string | null };
export type Hidden = Record<CatalogKind, string[]>;

export const isCatalogKind = (v: string): v is CatalogKind => (CATALOG_KINDS as readonly string[]).includes(v);
export const isGrantKind = (v: string): v is GrantKind => (GRANT_KINDS as readonly string[]).includes(v);

const CODE_KEYS: Record<CatalogKind, readonly string[]> = {
  banner: BANNER_PRESETS,
  accent: ACCENTS,
  frame: FRAMES.map((f) => f.key),
  badge: BADGE_KEYS,
};

export const isCatalogKey = (kind: CatalogKind, key: string) => CODE_KEYS[kind].includes(key);

/** Onde mora o nome do item em messages/*.json. */
export function messageKey(kind: CatalogKind, key: string): [string, string] {
  return kind === "badge" ? ["Badges", `${key}_name`] : ["ProfileStyle", `${kind}_${key}`];
}

type Messages = Record<string, unknown>;

/** Aplica os nomes trocados pela moderação sobre as mensagens (sem alterar o original). */
export function applyCatalogLabels<M extends Messages>(messages: M, rows: readonly CatalogRow[]): M {
  const renamed = rows.filter((r) => r.label);
  if (renamed.length === 0) return messages;
  const out: Messages = { ...messages };
  for (const r of renamed) {
    const [group, key] = messageKey(r.kind, r.key);
    out[group] = { ...(out[group] as Messages | undefined), [key]: r.label };
    // A dica de borda bloqueada usa uma cópia do nome da insígnia em Settings.
    const settings = out.Settings as Messages | undefined;
    if (r.kind === "badge" && typeof settings?.[`badge_${r.key}`] === "string") {
      out.Settings = { ...settings, [`badge_${r.key}`]: r.label };
    }
  }
  return out as M;
}

/**
 * O que some do editor de uma pessoa: itens desligados, menos o que ela já usa,
 * o que a moderação liberou para ela e (insígnias) o que ela já tem.
 */
export function hiddenItems(
  rows: readonly CatalogRow[],
  person: { banner?: string | null; accent?: string | null; frame?: string | null; grants?: readonly { kind: string; key: string }[]; earnedBadges?: readonly string[] },
): Hidden {
  const hidden: Hidden = { banner: [], accent: [], frame: [], badge: [] };
  const current: Record<CatalogKind, readonly string[]> = {
    banner: person.banner ? [person.banner] : [],
    accent: person.accent ? [person.accent] : [],
    frame: person.frame ? [person.frame] : [],
    badge: person.earnedBadges ?? [],
  };
  for (const r of rows) {
    if (r.active) continue;
    if (current[r.kind].includes(r.key)) continue;
    if (person.grants?.some((g) => g.kind === r.kind && g.key === r.key)) continue;
    hidden[r.kind].push(r.key);
  }
  return hidden;
}

/** Todos os itens do código, com o estado salvo no banco (para a aba Catálogo). */
export function catalogItems(rows: readonly CatalogRow[]): CatalogRow[] {
  return CATALOG_KINDS.flatMap((kind) =>
    CODE_KEYS[kind].map((key) => {
      const row = rows.find((r) => r.kind === kind && r.key === key);
      return { kind, key, active: row?.active ?? true, label: row?.label ?? null };
    }),
  );
}
