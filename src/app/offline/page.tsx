import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { StatusPage } from "@/components/status/status-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Status");
  return { title: t("offlineTitle"), robots: { index: false } };
}

/** Guardada pelo service worker (public/sw.js) e mostrada quando a navegação falha sem internet. */
export default function OfflinePage() {
  const t = useTranslations("Status");
  return <StatusPage title={t("offlineTitle")} text={t("offlineText")} />;
}
