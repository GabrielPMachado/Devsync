"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleLike } from "@/app/(app)/projetos/actions";
import { buttonClasses } from "@/components/ui/button";

/** Curtir ou descurtir o projeto. Visitante vai para /entrar e volta. */
export function LikeButton({ projectId, path, liked: initialLiked, count: initialCount, signedIn }: { projectId: string; path: string; liked: boolean; count: number; signedIn: boolean }) {
  const t = useTranslations("Projects");
  const [state, setState] = useState({ liked: initialLiked, count: initialCount });
  const [pending, start] = useTransition();
  if (!signedIn) {
    return (
      <Link href={`/entrar?next=${encodeURIComponent(path)}`} className={buttonClasses({ variant: "secondary" })} aria-label={t("signInToLike")}>
        <Heart className="size-4" aria-hidden="true" />
        {state.count}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? t("unlike") : t("like")}
      disabled={pending}
      className={buttonClasses({ variant: state.liked ? "primary" : "secondary" })}
      onClick={() => {
        const optimistic = { liked: !state.liked, count: state.count + (state.liked ? -1 : 1) };
        setState(optimistic);
        start(async () => {
          try {
            setState(await toggleLike(projectId, path));
          } catch {
            setState(state);
          }
        });
      }}
    >
      <Heart className={`size-4 ${state.liked ? "fill-current" : ""}`} aria-hidden="true" />
      <span data-testid="likes-count">{state.count}</span>
    </button>
  );
}
