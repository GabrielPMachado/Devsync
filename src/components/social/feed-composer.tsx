import { CircleHelp, FolderGit2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** Cartão do topo do Início: no celular a frase fica em cima e os botões embaixo. */
export function FeedComposer({ name }: { name: string }) {
  const t = useTranslations("Feed");
  const button = `${buttonClasses({ variant: "secondary", size: "sm" })} w-full sm:w-auto`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4 sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1 text-[15px] leading-snug font-medium text-text-secondary">{t("composer", { name })}</p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <Link href="/projetos/novo" className={button}>
          <FolderGit2 className="size-4" aria-hidden="true" />
          {t("newProject")}
        </Link>
        <Link href="/estudos/perguntar" className={button}>
          <CircleHelp className="size-4" aria-hidden="true" />
          {t("newQuestion")}
        </Link>
      </div>
    </div>
  );
}
