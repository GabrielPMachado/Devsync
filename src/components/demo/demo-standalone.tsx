"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DemoOverlay } from "./demo-overlay";

/** Página /demo/<id>: a camada ocupando a tela, com o aviso de conteúdo enviado por usuário. */
export function DemoStandalone({ demoId }: { demoId: string }) {
  const t = useTranslations("Demo");
  const router = useRouter();
  return (
    <>
      <DemoOverlay demoId={demoId} onClose={() => router.push("/projetos")} />
      <p role="note" className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 border-t border-status-warning/40 bg-status-warning-soft px-4 py-2 text-xs text-status-warning-text">
        <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
        <span>{t("userContent")}</span>
        <Link href="/projetos" className="font-semibold underline">
          {t("backToDevsync")}
        </Link>
      </p>
    </>
  );
}
