import type { SupabaseClient } from "@supabase/supabase-js";

export const COVER_BUCKET = "project-covers";
/** Capa recente e ainda sem projeto (publicação em andamento ou tentando de novo) não é apagada. */
const GRACE_MS = 24 * 60 * 60_000;
const FILE = /^cover-\d{1,20}\.webp(\?v=\d{1,20})?$/;

/**
 * A capa só aparece se estiver na pasta do autor, no Supabase do próprio site.
 * O banco já confere a pasta; o endereço do servidor só o site sabe.
 */
export function trustedCoverUrl(url: string | null | undefined, authorId: string, supabaseUrl: string | undefined): string | null {
  if (!url || !supabaseUrl) return null;
  const prefix = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${COVER_BUCKET}/${authorId}/`;
  return url.startsWith(prefix) && FILE.test(url.slice(prefix.length)) ? url : null;
}

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
    supabase.storage.from(COVER_BUCKET).list(userId, { limit: 1000 }),
    supabase.from("projects").select("cover_url").eq("author_id", userId),
  ]);
  const used = new Set(((projects ?? []) as { cover_url: string | null }[]).map((p) => coverFileName(p.cover_url)));
  const orphans = (files ?? [])
    .filter((f) => !used.has(f.name) && now - Date.parse(f.created_at ?? "") > GRACE_MS)
    .map((f) => `${userId}/${f.name}`);
  if (orphans.length) await supabase.storage.from(COVER_BUCKET).remove(orphans);
}
