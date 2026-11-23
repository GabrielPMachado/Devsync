import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

// Sem prefixo de idioma na URL: por enquanto o idioma é sempre pt-BR.
// Quando o inglês chegar, o idioma passa a vir de um cookie ou do perfil.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    timeZone: "America/Sao_Paulo",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
