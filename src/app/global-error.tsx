"use client";

import messages from "../../messages/pt-BR.json";

// Substitui o layout raiz quando ele mesmo falha: sem provedor do next-intl e
// sem o CSS global, por isso os textos vêm direto do arquivo e o estilo é inline.
const t = messages.Status;

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#070B14", color: "#F8FAFC", fontFamily: "system-ui, sans-serif" }}>
        <title>{messages.Metadata.title}</title>
        <main style={{ maxWidth: 480, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>{t.errorTitle}</h1>
          <p style={{ color: "#94A3B8", lineHeight: 1.6, margin: "0 0 24px" }}>{t.errorText}</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ background: "#2563EB", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
          >
            {t.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
