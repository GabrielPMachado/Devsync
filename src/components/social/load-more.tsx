"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { moreFeed } from "@/app/(app)/feed-actions";
import { Button } from "@/components/ui/button";

/** "Carregar mais": acrescenta as próximas páginas do início embaixo das que já estão na tela. */
export function LoadMore({ cursor, label }: { cursor: string | null; label: string }) {
  const t = useTranslations("Feed");
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [next, setNext] = useState(cursor);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      {pages.map((node, i) => (
        <div key={i}>{node}</div>
      ))}
      {next ? (
        <Button
          variant="secondary"
          className="self-center"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const page = await moreFeed(next, label);
                setPages((p) => [...p, page.node]);
                setNext(page.next);
                setFailed(false);
              } catch {
                setFailed(true);
              }
            })
          }
        >
          {pending ? t("loading") : t("more")}
        </Button>
      ) : pages.length > 0 || cursor === null ? (
        <p className="text-center text-sm text-text-subtle">{t("end")}</p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-center text-sm text-status-danger-text">
          {t("loadError")}
        </p>
      ) : null}
    </>
  );
}
