import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { groupTagsByCategory } from "@/lib/tags/categories";

/** Lista de assuntos separada por categoria (Linguagens, Front-end...). Quem usa decide como cada tag aparece. */
export function TagGroups<T extends { slug: string }>({
  tags,
  renderTag,
}: {
  tags: readonly T[];
  renderTag: (tag: T) => ReactNode;
}) {
  const t = useTranslations("TagCategories");
  return (
    <div className="flex flex-col gap-4">
      {groupTagsByCategory(tags).map((group) => (
        <div
          key={group.id}
          role="group"
          aria-label={t(group.id)}
          className="flex flex-col gap-2"
        >
          <p
            aria-hidden="true"
            className="text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase"
          >
            {t(group.id)}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.tags.map(renderTag)}
          </div>
        </div>
      ))}
    </div>
  );
}
