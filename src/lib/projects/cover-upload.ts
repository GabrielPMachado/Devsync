"use client";

import { createClient } from "@/lib/supabase/client";
import { uploadCover } from "./covers";

/** Envia a capa recortada pelo Supabase do navegador, na pasta de quem está logado. */
export async function uploadMyCover(blob: Blob): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("upload-failed");
  return uploadCover(supabase, data.user.id, blob);
}
