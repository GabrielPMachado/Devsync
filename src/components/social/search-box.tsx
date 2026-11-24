"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Campo de busca do topo. Ctrl K (ou ⌘K) foca; Enter abre /busca?q=. */
export function SearchBox({ initial = "", className = "" }: { initial?: string; className?: string }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initial);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      action="/busca"
      className={`flex h-9 items-center gap-2 rounded-md border border-border-default bg-bg-base px-3 text-sm focus-within:border-border-focus ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const value = q.trim();
        router.push(value ? `/busca?q=${encodeURIComponent(value)}` : "/busca");
      }}
    >
      <Search className="size-4 shrink-0 text-text-subtle" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search")}
        aria-label={t("searchShort")}
        maxLength={200}
        className="h-full min-w-0 flex-1 bg-transparent text-text-primary placeholder:text-text-subtle focus:outline-none"
      />
      <kbd className="hidden rounded-sm border border-border-default px-1.5 font-mono text-[10px] text-text-subtle xl:inline">Ctrl K</kbd>
    </form>
  );
}
