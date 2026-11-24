"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Marca como lidas as notificações mostradas (ids) ou todas (sem ids). A RLS só deixa mexer nas próprias. */
export async function markRead(ids?: string[]): Promise<void> {
  const viewer = await getViewer();
  if (!viewer) return;
  const supabase = await createClient();
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", viewer.id).is("read_at", null);
  if (ids) {
    const valid = ids.filter((id) => UUID.test(id)).slice(0, 200);
    if (valid.length === 0) return;
    query = query.in("id", valid);
  }
  await query;
}

/** Botão "Marcar todas como lidas". */
export async function markAllRead(): Promise<void> {
  await markRead();
  revalidatePath("/notificacoes");
}
