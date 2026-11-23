import Link from "next/link";

/** Tag clicável que filtra a lista. A tag iniciante tem destaque (seção 5.4). */
export function StudyTag({ slug }: { slug: string }) {
  const beginner = slug === "iniciante";
  return (
    <Link
      href={`/estudos?tag=${encodeURIComponent(slug)}`}
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-xs transition-colors ${
        beginner
          ? "border-brand-accent bg-brand-accent-soft text-brand-accent"
          : "border-border-default bg-bg-elevated text-text-secondary hover:border-border-strong hover:text-text-primary"
      }`}
    >
      {slug}
    </Link>
  );
}
