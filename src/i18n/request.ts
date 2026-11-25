import { getRequestConfig } from "next-intl/server";
import { applyCatalogLabels } from "@/lib/moderation/catalog";
import { getCatalogRows } from "@/lib/moderation/catalog-state";
import { defaultLocale } from "./config";

// Sem prefixo de idioma na URL: por enquanto o idioma é sempre pt-BR.
// Quando o inglês chegar, o idioma passa a vir de um cookie ou do perfil.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return {
    locale,
    timeZone: "America/Sao_Paulo",
    // Nomes de banners, cores, bordas e insígnias trocados pela moderação (/admin?aba=catalogo).
    messages: applyCatalogLabels(messages, await getCatalogRows()),
  };
});
