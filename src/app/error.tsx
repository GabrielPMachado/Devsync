"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { StatusPage } from "@/components/status/status-page";
import { Button, buttonClasses } from "@/components/ui/button";

/**
 * Erro inesperado numa página. O caso mais comum é o Supabase gratuito pausado
 * ou instável: em vez de uma tela de erro, um aviso amigável de manutenção.
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Status");
  return (
    <StatusPage title={t("errorTitle")} text={t("errorText")}>
      <Button onClick={() => retry()}>{t("retry")}</Button>
      <Link href="/" className={buttonClasses({ variant: "secondary" })}>
        {t("home")}
      </Link>
    </StatusPage>
  );
}
