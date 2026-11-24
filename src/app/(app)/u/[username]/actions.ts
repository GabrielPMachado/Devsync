"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/safe-next";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

/** "/@ana/seguidores" é servido por "/u/ana/seguidores" (rewrite do next.config). */
function routeOf(path: string) {
  return path.replace(/^\/@/, "/u/").split("?")[0];
}

/**
 * Segue (follow = true) ou deixa de seguir. Recebe o estado desejado, não um
 * "inverter": um botão desatualizado em outra aba não desfaz o que a pessoa quer.
 * Devolve o estado e o contador de seguidores do banco.
 */
export async function setFollow(profileId: string, follow: boolean, rawPath: string): Promise<{ following: boolean; followers: number }> {
  const path = safeNext(rawPath);
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(path)}`);
  if (profileId === viewer.id) throw new Error("Não dá para seguir a si mesmo.");

  const supabase = await createClient();
  const { error } = follow
    ? await supabase.from("follows").upsert({ follower_id: viewer.id, followee_id: profileId }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true })
    : await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("followee_id", profileId);
  if (error) throw new Error("Não deu para seguir agora.");

  const { data } = await supabase.from("profiles").select("followers_count").eq("id", profileId).single();
  revalidatePath(routeOf(path));
  return { following: follow, followers: data?.followers_count ?? 0 };
}
