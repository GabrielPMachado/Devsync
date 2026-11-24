"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setFollow } from "@/app/(app)/u/[username]/actions";
import { buttonClasses } from "@/components/ui/button";

type Props = {
  profileId: string;
  username: string;
  following: boolean;
  signedIn: boolean;
  /** Página atual, para voltar depois do login. */
  path: string;
  size?: "sm" | "md";
  /** Texto do botão quando a pessoa ainda não segue (ex.: "Seguir de volta"). */
  label?: string;
  onChange?: (state: { following: boolean; followers: number }) => void;
};

/** Seguir / Seguindo. Visitante vai para /entrar e volta. */
export function FollowButton({ profileId, username, following: initial, signedIn, path, size = "md", label, onChange }: Props) {
  const t = useTranslations("Social");
  const [following, setFollowing] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const text = following ? t("following") : (label ?? t("follow"));
  const Icon = following ? UserCheck : UserPlus;

  if (!signedIn) {
    return (
      <Link href={`/entrar?next=${encodeURIComponent(path)}`} className={buttonClasses({ size })}>
        <UserPlus className="size-4" aria-hidden="true" />
        {text}
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={following}
        aria-label={following ? t("unfollowUser", { username }) : t("followUser", { username })}
        title={following ? t("unfollow") : undefined}
        disabled={pending}
        className={buttonClasses({ variant: following ? "secondary" : "primary", size })}
        onClick={() => {
          const before = following;
          setFollowing(!before);
          setNotice(null);
          start(async () => {
            try {
              const next = await setFollow(profileId, !before, path);
              setFollowing(next.following);
              setNotice(next.following ? t("nowFollowing", { username }) : null);
              onChange?.(next);
            } catch {
              setFollowing(before);
              setNotice(t("followError"));
            }
          });
        }}
      >
        <Icon className="size-4" aria-hidden="true" />
        {text}
      </button>
      <span role="status" className="sr-only">
        {notice}
      </span>
    </span>
  );
}
