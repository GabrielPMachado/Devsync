import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Perfil em devsync.app/@usuario (a rota de verdade é /u/[username]).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          demosUrl: process.env.NEXT_PUBLIC_DEMOS_URL,
          dev: process.env.NODE_ENV !== "production",
        }),
      },
    ];
  },
  async rewrites() {
    return [{ source: "/@:username", destination: "/u/:username" }];
  },
  experimental: {
    // Foto de perfil vai pela Server Action: até 2 MB (AVATAR_MAX_BYTES) mais o resto do formulário.
    serverActions: { bodySizeLimit: "3mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
