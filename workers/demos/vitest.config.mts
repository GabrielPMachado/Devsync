import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          DEMOS_HOST: "demos.test",
          SITE_URL: "https://devsync.app",
          FRAME_ANCESTORS: "",
          SUPABASE_URL: "https://sb.test",
          SUPABASE_ANON_KEY: "anon-key",
          SUPABASE_SERVICE_ROLE_KEY: "service-key",
          UPLOAD_SIGNING_SECRET: "segredo-de-teste",
        },
      },
    }),
  ],
  test: { include: ["test/**/*.test.ts"] },
});
