"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

const SLUG = /^[a-z0-9][a-z0-9+#.-]{0,29}$/;

/** Acompanha (follow = true) ou deixa de acompanhar uma tag (entra no início). Recebe o estado desejado. */
export async function setTagFollow(slug: string, follow: boolean): Promise<{ followed: boolean }> {
  if (!SLUG.test(slug)) throw new Error("Tag inválida.");
  const path = `/tags/${slug}`;
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(path)}`);
  const supabase = await createClient();
  const { data: tag } = await supabase.from("tags").select("id").eq("slug", slug).maybeSingle();
  if (!tag) throw new Error("Tag não encontrada.");
  const { error } = follow
    ? await supabase.from("tag_follows").upsert({ profile_id: viewer.id, tag_id: tag.id }, { onConflict: "profile_id,tag_id", ignoreDuplicates: true })
    : await supabase.from("tag_follows").delete().eq("profile_id", viewer.id).eq("tag_id", tag.id);
  if (error) throw new Error("Não deu para acompanhar agora.");
  revalidatePath(path);
  revalidatePath("/");
  return { followed: follow };
}
