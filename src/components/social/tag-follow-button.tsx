"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleTagFollow } from "@/app/(app)/tags/actions";
import { buttonClasses } from "@/components/ui/button";

/** Acompanhar / Acompanhando uma tag. */
export function TagFollowButton({ slug, followed: initial, signedIn }: { slug: string; followed: boolean; signedIn: boolean }) {
  const t = useTranslations("Discover");
  const [followed, setFollowed] = useState(initial);
  const [pending, start] = useTransition();
  if (!signedIn) {
    return (
      <Link href={`/entrar?next=${encodeURIComponent(`/tags/${slug}`)}`} className={buttonClasses()}>
        <Plus className="size-4" aria-hidden="true" />
        {t("followTag")}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={followed}
      disabled={pending}
      className={buttonClasses({ variant: followed ? "secondary" : "primary" })}
      onClick={() => {
        const before = followed;
        setFollowed(!before);
        start(async () => {
          try {
            setFollowed((await toggleTagFollow(slug)).followed);
          } catch {
            setFollowed(before);
          }
        });
      }}
    >
      {followed ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
      {followed ? t("followingTag") : t("followTag")}
    </button>
  );
}
