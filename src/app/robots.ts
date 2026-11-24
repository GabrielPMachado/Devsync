import type { MetadataRoute } from "next";
import { publicBaseUrl } from "@/lib/seo/base-url";

export default function robots(): MetadataRoute.Robots {
  const base = publicBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Páginas pessoais, de login e de edição não servem para busca.
      disallow: ["/admin", "/auth/", "/entrar", "/boas-vindas", "/notificacoes", "/demo/", "/projetos/novo", "/estudos/perguntar", "/*/editar", "/*/historico"],
    },
    sitemap: new URL("/sitemap.xml", base).href,
    host: base.origin,
  };
}
