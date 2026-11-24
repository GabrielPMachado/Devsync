import type { CropKind } from "@/lib/images/crop-math";

export const IMAGE_BUCKET = { avatar: "avatars", banner: "banners" } as const;

/**
 * A URL aponta para um arquivo público do nosso Storage, no bucket certo e
 * dentro da pasta da própria pessoa? (O banco confere de novo; isto evita
 * mandar algo que ele vai recusar e dá um erro claro na tela.)
 */
export function isOwnStorageUrl(url: string, supabaseUrl: string, kind: CropKind, userId: string): boolean {
  let u: URL;
  let base: URL;
  try {
    u = new URL(url);
    base = new URL(supabaseUrl);
  } catch {
    return false;
  }
  if (u.origin !== base.origin) return false;
  const prefix = `${base.pathname.replace(/\/$/, "")}/storage/v1/object/public/${IMAGE_BUCKET[kind]}/${userId}/`;
  // new URL() já resolve "../"; olhar o caminho cru pega também %2e%2e e "//".
  const raw = url.slice(u.origin.length).split(/[?#]/)[0];
  if (!raw.startsWith(prefix)) return false;
  const rest = raw.slice(prefix.length);
  return rest.length > 0 && !rest.split("/").some((part) => part === "" || /^(\.|%2e)+$/i.test(part));
}
