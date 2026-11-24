import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { followingSet, getProfile, listConnections } from "@/lib/social/queries";
import { PersonRow } from "./person-row";

/** Lista de seguidores ou de quem o perfil segue. */
export async function ConnectionsPage({ username, who }: { username: string; who: "followers" | "following" }) {
  const [profile, viewer] = await Promise.all([getProfile(username), getViewer()]);
  if (!profile) notFound();
  const people = await listConnections(profile.id, who);
  const follows = await followingSet(viewer?.id, people.map((p) => p.id));
  const t = await getTranslations("Social");
  const base = `/@${profile.username}`;
  const path = `${base}/${who === "followers" ? "seguidores" : "seguindo"}`;
  const name = profile.displayName || profile.username;
  return (
    <div className="flex flex-col gap-5">
      <Link href={base} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {name}
      </Link>
      <h1 className="font-display text-2xl font-bold text-text-primary">{who === "followers" ? t("followersOf", { name }) : t("followingOf", { name })}</h1>
      {people.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-default px-4 py-10 text-center text-sm text-text-muted">{who === "followers" ? t("noFollowers") : t("noFollowing")}</p>
      ) : (
        <ul className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-surface p-4">
          {people.map((p) => (
            <li key={p.id}>
              <PersonRow person={p} following={follows.has(p.id)} viewerId={viewer?.id ?? null} path={path} showBio />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
