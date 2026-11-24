"use server";

import type { ReactNode } from "react";
import { FeedList } from "@/components/social/feed-list";
import { getViewer } from "@/lib/auth/viewer";
import { loadFeed } from "@/lib/social/queries";

/** Próxima página do início, já renderizada. cursor = created_at do último item, como veio do banco (com microssegundos). */
export async function moreFeed(cursor: string, label: string): Promise<{ node: ReactNode; next: string | null }> {
  const viewer = await getViewer();
  if (!viewer || typeof cursor !== "string" || cursor.length > 40 || Number.isNaN(Date.parse(cursor))) return { node: null, next: null };
  const { items, next } = await loadFeed(cursor);
  return { node: items.length ? <FeedList items={items} basePath="/" label={label} /> : null, next };
}
