import type { SupabaseClient } from "@supabase/supabase-js";

export const COVER_BUCKET = "project-covers";
/** Capa recém-enviada e ainda sem projeto (publicação em andamento) não é apagada. */
const GRACE_MS = 10 * 60_000;

/** Nome do arquivo no fim da URL do Storage ("" = nenhum). */
export function coverFileName(url: string | null | undefined): string {
  return url ? (url.split(/[?#]/)[0].split("/").pop() ?? "") : "";
}

/**
 * Envia a capa recortada para project-covers/<pessoa>/cover-<ts>.webp e devolve a
 * URL pública com ?v= (fura o cache). Nome novo a cada envio: sem upsert.
 */
export async function uploadCover(supabase: SupabaseClient, userId: string, blob: Blob, now = Date.now()): Promise<string> {
  const bucket = supabase.storage.from(COVER_BUCKET);
  const path = `${userId}/cover-${now}.webp`;
  const { error } = await bucket.upload(path, blob, { upsert: false, contentType: blob.type, cacheControl: "3600" });
  if (error) throw new Error("upload-failed");
  return `${bucket.getPublicUrl(path).data.publicUrl}?v=${now}`;
}

/**
 * Apaga as capas da pasta da pessoa que nenhum projeto dela usa (trocadas, removidas,
 * de projetos excluídos ou de publicações que falharam). Falhar aqui não é erro.
 */
export async function cleanOrphanCovers(supabase: SupabaseClient, userId: string, now = Date.now()): Promise<void> {
  const [{ data: files }, { data: projects }] = await Promise.all([
    supabase.storage.from(COVER_BUCKET).list(userId),
    supabase.from("projects").select("cover_url").eq("author_id", userId),
  ]);
  const used = new Set(((projects ?? []) as { cover_url: string | null }[]).map((p) => coverFileName(p.cover_url)));
  const orphans = (files ?? [])
    .filter((f) => !used.has(f.name) && now - Date.parse(f.created_at ?? "") > GRACE_MS)
    .map((f) => `${userId}/${f.name}`);
  if (orphans.length) await supabase.storage.from(COVER_BUCKET).remove(orphans);
}
