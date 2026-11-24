"use client";

import { useEffect } from "react";
import { markRead } from "@/app/(app)/notificacoes/actions";
import { setUnread } from "./unread-store";

/** Ao abrir a página de notificações, marca as mostradas como lidas e zera o contador do sino. */
export function MarkSeen({ ids, remaining }: { ids: string[]; remaining: number }) {
  const key = ids.join(",");
  useEffect(() => {
    setUnread(remaining);
    if (key) void markRead(key.split(","));
  }, [key, remaining]);
  return null;
}
