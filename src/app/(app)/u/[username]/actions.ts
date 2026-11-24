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

/** Segue ou deixa de seguir. Devolve o estado novo e o contador de seguidores do banco. */
export async function toggleFollow(profileId: string, rawPath: string): Promise<{ following: boolean; followers: number }> {
  const path = safeNext(rawPath);
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(path)}`);
  if (profileId === viewer.id) throw new Error("Não dá para seguir a si mesmo.");

  const supabase = await createClient();
  const { data: existing } = await supabase.from("follows").select("followee_id").eq("follower_id", viewer.id).eq("followee_id", profileId).maybeSingle();
  const { error } = existing
    ? await supabase.from("follows").delete().eq("follower_id", viewer.id).eq("followee_id", profileId)
    : await supabase.from("follows").insert({ followee_id: profileId });
  if (error) throw new Error("Não deu para seguir agora.");

  const { data } = await supabase.from("profiles").select("followers_count").eq("id", profileId).single();
  revalidatePath(routeOf(path));
  return { following: !existing, followers: data?.followers_count ?? 0 };
}
