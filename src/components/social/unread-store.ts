"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Contador de notificações não lidas, compartilhado pelo sino e pela aba do
 * celular. Uma assinatura só do Supabase Realtime por página (a RLS garante
 * que só chegam as notificações da própria pessoa).
 */

type Listener = () => void;
const listeners = new Set<Listener>();
const arrivals = new Set<(id: string) => void>();
let count: number | null = null;
let subscribedFor: string | null = null;

function emit() {
  for (const l of listeners) l();
}

export function setUnread(value: number) {
  count = Math.max(0, value);
  emit();
}

export function onArrival(fn: (id: string) => void) {
  arrivals.add(fn);
  return () => {
    arrivals.delete(fn);
  };
}

async function subscribe(userId: string) {
  if (subscribedFor === userId) return;
  subscribedFor = userId;
  let supabase;
  try {
    supabase = createClient();
  } catch {
    return;
  }
  // Garante que o Realtime use o token da sessão (senão a RLS não deixa nada passar).
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.realtime.setAuth(data.session.access_token);
  supabase
    .channel(`notificacoes:${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, (payload) => {
      setUnread((count ?? 0) + 1);
      const id = (payload.new as { id?: string }).id ?? "";
      for (const fn of arrivals) fn(id);
    })
    .subscribe();
}

/** Número de não lidas. initial vem do servidor; userId null = visitante (sem assinatura). */
export function useUnread(userId: string | null, initial: number): number {
  useEffect(() => {
    if (count === null) setUnread(initial);
    if (userId) void subscribe(userId);
  }, [userId, initial]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => count ?? initial,
    () => initial,
  );
}
