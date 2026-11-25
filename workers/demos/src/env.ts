export interface Env {
  /** Host base das demos. A API fica nele e cada demo em `<demo_id>.<DEMOS_HOST>`. */
  DEMOS_HOST: string;
  /**
   * "subdomain" (padrão): cada demo em `<id>.<DEMOS_HOST>`, origem própria (precisa de domínio com DNS curinga).
   * "path": cada demo em `<DEMOS_HOST>/d/<id>/`, para o workers.dev grátis. As demos dividem a origem entre si.
   */
  DEMOS_MODE?: string;
  /** Origem do site, ex.: https://devsync.app. Destino dos redirecionamentos. */
  SITE_URL: string;
  /** Origens (separadas por espaço) que podem embutir demos e chamar a API. Padrão: SITE_URL. */
  FRAME_ANCESTORS?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  UPLOAD_SIGNING_SECRET: string;
  SAFE_BROWSING_API_KEY?: string;
  /** Repositório público que compila demos (ex.: GabrielPMachado/devsync-builds). Sem ele, o build fica desligado. */
  BUILDER_REPO?: string;
  /** ID numérico do BUILDER_REPO (opcional, recomendado): o token tem de vir desse repositório, não só do nome. */
  BUILDER_REPO_ID?: string;
  /** Token do GitHub (fine-grained, só o BUILDER_REPO, Actions: write) para disparar o workflow. */
  BUILDER_GITHUB_TOKEN?: string;
  /** Print automático das demos (Cloudflare Browser Rendering, API REST). Sem os dois, fica desligado. */
  CLOUDFLARE_ACCOUNT_ID?: string;
  /** Token da Cloudflare só com a permissão "Browser Rendering: Edit". */
  BROWSER_RENDERING_TOKEN?: string;
  DEMOS_BUCKET: R2Bucket;
  ZIP_QUEUE: Queue<ZipMessage>;
  LINK_QUEUE: Queue<LinkMessage>;
  /** Limite de chamadas da API por IP (binding de rate limit). Sem ele, não limita (dev e testes). */
  API_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export interface ZipMessage {
  demoId: string;
  version: number;
}

export interface LinkMessage {
  demoId: string;
}

/** Dependências externas trocáveis nos testes. */
export interface Deps {
  fetch: typeof fetch;
  now: () => number;
}

export const defaultDeps = (): Deps => ({
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
});

export function allowedOrigins(env: Env): string[] {
  const list = (env.FRAME_ANCESTORS ?? "").split(/\s+/).filter(Boolean);
  return list.length > 0 ? list : [new URL(env.SITE_URL).origin];
}
