import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { defaultLocale } from "@/i18n/config";
import messages from "../../messages/pt-BR.json";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// alt precisa ser constante: vem direto do arquivo de textos.
export const alt = messages.Metadata.ogAlt;

/** Imagem que aparece quando alguém compartilha um link da Devsync. */
export default async function OpenGraphImage() {
  const t = await getTranslations({ locale: defaultLocale, namespace: "Metadata" });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 96, background: "linear-gradient(135deg, #070B14 0%, #0F1B3D 100%)", color: "#F8FAFC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="120" height="120" viewBox="0 0 32 32">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2563EB" />
                <stop offset="1" stopColor="#22D3EE" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#g)" />
            <path d="M13 11l-5 5 5 5M19 11l5 5-5 5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 800, letterSpacing: -3 }}>
            <span>Dev</span>
            <span style={{ color: "#22D3EE" }}>sync</span>
          </div>
        </div>
        <div style={{ marginTop: 40, fontSize: 44, fontWeight: 700, color: "#22D3EE" }}>{t("tagline")}</div>
        <div style={{ marginTop: 20, fontSize: 32, lineHeight: 1.4, color: "#94A3B8", maxWidth: 960 }}>{t("description")}</div>
      </div>
    ),
    size,
  );
}
