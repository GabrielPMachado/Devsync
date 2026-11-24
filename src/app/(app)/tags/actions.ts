"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

const SLUG = /^[a-z0-9][a-z0-9+#.-]{0,29}$/;

/** Acompanha ou deixa de acompanhar uma tag (entra no início). Devolve o estado novo. */
export async function toggleTagFollow(slug: string): Promise<{ followed: boolean }> {
  if (!SLUG.test(slug)) throw new Error("Tag inválida.");
  const path = `/tags/${slug}`;
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(path)}`);
  const supabase = await createClient();
  const { data: tag } = await supabase.from("tags").select("id").eq("slug", slug).maybeSingle();
  if (!tag) throw new Error("Tag não encontrada.");
  const { data: existing } = await supabase.from("tag_follows").select("tag_id").eq("profile_id", viewer.id).eq("tag_id", tag.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("tag_follows").delete().eq("profile_id", viewer.id).eq("tag_id", tag.id)
    : await supabase.from("tag_follows").insert({ profile_id: viewer.id, tag_id: tag.id });
  if (error) throw new Error("Não deu para acompanhar agora.");
  revalidatePath(path);
  revalidatePath("/");
  return { followed: !existing };
}
