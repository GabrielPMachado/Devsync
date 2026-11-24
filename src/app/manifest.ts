import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { defaultLocale } from "@/i18n/config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: defaultLocale, namespace: "Metadata" });
  return {
    id: "/",
    name: t("title"),
    short_name: t("shortName"),
    description: t("description"),
    lang: defaultLocale,
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#070B14",
    theme_color: "#070B14",
    categories: ["social", "developer", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
