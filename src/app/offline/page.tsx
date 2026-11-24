import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Status");
  return { title: t("offlineTitle"), robots: { index: false } };
}

/**
 * Guardada pelo service worker (public/sw.js) e mostrada quando a navegação
 * falha sem internet. Sem rede, o CSS e as fontes do site não carregam: por isso
 * o estilo é inline e a fonte é a do sistema.
 */
export default function OfflinePage() {
  const t = useTranslations("Status");
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center", background: "#070B14", color: "#F8FAFC", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="offline-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563EB" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#offline-logo)" />
        <path d="M13 11l-5 5 5 5M19 11l5 5-5 5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t("offlineTitle")}</h1>
      <p style={{ maxWidth: 420, margin: 0, lineHeight: 1.6, color: "#94A3B8" }}>{t("offlineText")}</p>
    </main>
  );
}
