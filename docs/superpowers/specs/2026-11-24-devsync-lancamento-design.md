# Devsync subprojeto 8: lançamento (desenho curto)

**Objetivo (roteiro):** PWA, SEO, revisão de segurança e testes de carga leves. Critério: PWA instalável e revisão de segurança sem pendências abertas no código.

## Abordagens consideradas

1. **Tudo num PR, sem serviços novos (escolhida).** Next.js já gera manifest, sitemap, robots e imagem Open Graph por arquivos em `src/app/`. Cabeçalhos via `next.config.ts`. Carga com um script Node no CI, contra o Supabase local.
2. **Bibliotecas prontas (next-pwa/serwist, k6, Lighthouse CI).** Mais peças para manter. O next-pwa não acompanha o Next 16 com Turbopack; k6 e Lighthouse CI exigem instalar binários no CI. Descartada.
3. **CSP com nonce por pedido.** Mais restrita, mas obriga a renderizar todas as páginas por pedido e perde o pré-render parcial (`cacheComponents`). Descartada: a CSP usa `'unsafe-inline'` em script e fecha o resto (iframe, plugins, conexões).

## Decisões

- **Banco:** migration que tira `EXECUTE` de `public`, `anon` e `authenticated` em todas as funções de gatilho de `public` e em `assert_admin`. Gatilho não precisa de `EXECUTE` para disparar. Teste pgTAP impede regressão. `is_admin`, `is_active_user` e `content_is_visible` continuam executáveis porque a RLS as chama.
- **Service worker** escrito à mão (`public/sw.js`): só a página "sem internet" fica em cache (nada de páginas com dados de conta) e já trata `push`/`notificationclick`. Envio de push (VAPID) fica para depois.
- **Erro e manutenção:** `error.tsx` amigável cobre o Supabase pausado (roteiro, ponto de atenção 5). `global-error.tsx` cobre falha do layout raiz.
- **SEO:** `metadataBase` de `NEXT_PUBLIC_SITE_URL` (ou o domínio de produção da Vercel). Sitemap com projetos, perguntas e perfis lidos com a chave anon (RLS tira ocultos), cache de 1 hora.
- **Demos:** limite de 30 chamadas/minuto por IP na API (binding de rate limit da Cloudflare, só em produção). Configuração `env.production` no `wrangler.jsonc` e workflow manual de publicação. A pessoa só compra domínio e Workers Paid.

## Fora do escopo

Push de verdade, domínio próprio do site, inglês, monitoramento pago.
