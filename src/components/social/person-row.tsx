import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { Person } from "@/lib/social/queries";
import { FollowButton } from "./follow-button";

/** Linha de pessoa (Quem seguir, busca, seguidores). Sem botão para a própria pessoa. */
export function PersonRow({ person, following, viewerId, path, showBio = false }: { person: Person; following: boolean; viewerId: string | null; path: string; showBio?: boolean }) {
  const name = person.displayName || person.username;
  return (
    <div className="flex items-center gap-3">
      <Link href={`/@${person.username}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
        <Avatar name={name} src={person.avatarUrl} size="sm" />
      </Link>
      <div className="min-w-0 flex-1 leading-tight">
        <Link href={`/@${person.username}`} className="block truncate text-sm font-semibold text-text-primary hover:text-text-link">
          {name}
        </Link>
        <p className={`text-xs text-text-muted ${showBio && person.bio ? "line-clamp-2" : "truncate font-mono"}`}>{showBio && person.bio ? person.bio : `@${person.username}`}</p>
      </div>
      {viewerId === person.id ? null : <FollowButton profileId={person.id} username={person.username} following={following} signedIn={!!viewerId} path={path} size="sm" />}
    </div>
  );
}
