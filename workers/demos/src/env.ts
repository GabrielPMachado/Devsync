export interface Env {
  /** Host base das demos. A API fica nele e cada demo em `<demo_id>.<DEMOS_HOST>`. */
  DEMOS_HOST: string;
  /** Origem do site, ex.: https://devsync.app. Destino dos redirecionamentos. */
  SITE_URL: string;
  /** Origens (separadas por espaço) que podem embutir demos e chamar a API. Padrão: SITE_URL. */
  FRAME_ANCESTORS?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  UPLOAD_SIGNING_SECRET: string;
  SAFE_BROWSING_API_KEY?: string;
  DEMOS_BUCKET: R2Bucket;
  ZIP_QUEUE: Queue<ZipMessage>;
  LINK_QUEUE: Queue<LinkMessage>;
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
