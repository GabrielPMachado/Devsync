import type { SupabaseClient } from "@supabase/supabase-js";
import type { CropKind } from "@/lib/images/crop-math";

export const IMAGE_BUCKET = { avatar: "avatars", banner: "banners", cover: "project-covers" } as const;

/** Imagem do perfil ainda não salva: manter a atual, remover, ou trocar por uma recortada. */
export type PendingImage = { kind: "keep" } | { kind: "remove" } | { kind: "new"; blob: Blob; previewUrl: string };

/**
 * Um arquivo novo a cada envio: o que está publicado só muda quando o perfil
 * salva. A ação de salvar apaga os antigos da pasta (sem órfãos).
 */
export function imagePath(userId: string, kind: CropKind, stamp: number): string {
  return `${userId}/${kind}-${stamp}.webp`;
}

/** Envia a imagem recortada e devolve a URL pública com ?v= para furar o cache. */
export async function uploadProfileImage(supabase: SupabaseClient, userId: string, kind: CropKind, blob: Blob, now = Date.now()): Promise<string> {
  const bucket = supabase.storage.from(IMAGE_BUCKET[kind]);
  const path = imagePath(userId, kind, now);
  // Nome novo a cada envio: sem upsert (que exigiria permissão de leitura e troca).
  // O caminho é sempre .webp; se o navegador só gerou JPEG, o contentType diz a verdade.
  const { error } = await bucket.upload(path, blob, { upsert: false, contentType: blob.type, cacheControl: "3600" });
  if (error) throw new Error("upload-failed");
  return `${bucket.getPublicUrl(path).data.publicUrl}?v=${now}`;
}

/**
 * Antes de salvar: envia as imagens novas e devolve os campos do formulário.
 * Campo ausente = não mexe; "" = remover; URL = a imagem enviada.
 */
export async function preparePendingImages(
  supabase: SupabaseClient,
  userId: string,
  pending: Record<"avatar" | "banner", PendingImage>,
  now = Date.now(),
): Promise<{ avatarUrl?: string; bannerUrl?: string }> {
  const field = async (kind: "avatar" | "banner"): Promise<string | undefined> => {
    const p = pending[kind];
    if (p.kind === "keep") return undefined;
    if (p.kind === "remove") return "";
    return uploadProfileImage(supabase, userId, kind, p.blob, now);
  };
  const [avatarUrl, bannerUrl] = await Promise.all([field("avatar"), field("banner")]);
  return {
    ...(avatarUrl !== undefined && { avatarUrl }),
    ...(bannerUrl !== undefined && { bannerUrl }),
  };
}
