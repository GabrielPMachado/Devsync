# Serviço de demos (Cloudflare Worker)

Recebe o `.zip` de uma demo, valida e descompacta no R2, serve cada demo num subdomínio próprio só dentro de iframe da Devsync e checa se links de demo aceitam ser embutidos. Plano: [`docs/superpowers/plans/2026-11-23-devsync-servico-de-demos.md`](../../docs/superpowers/plans/2026-11-23-devsync-servico-de-demos.md).

## Como rodar

```bash
cd workers/demos
npm install
npm test            # Vitest dentro do runtime do Workers (Miniflare): R2 e filas locais
npm run typecheck
npm run dev         # wrangler dev em http://localhost:8787
```

No `wrangler dev`, a API responde no host `demos.localhost` e cada demo em `<demo_id>.demos.localhost` (o navegador resolve `*.localhost` sozinho). Segredos locais vão em `.dev.vars` (fora do git).

## Hosts

| Host | O quê |
|---|---|
| `DEMOS_HOST` | API (abaixo) |
| `<demo_id>.DEMOS_HOST` | Arquivos da demo |

O `workers.dev` grátis não aceita um subdomínio por demo. Para publicar, é preciso um domínio próprio com rota curinga `*.<domínio>/*` apontando para o Worker (decisão de 2026-11-23: comprar o domínio no lançamento).

## API

Todas as rotas recebem `Authorization: Bearer <access token do Supabase>`. O Worker chama o Supabase **como o usuário**, então a RLS e os gatilhos valem (e-mail confirmado, 5 envios por dia, conta suspensa). Só o resultado da validação é gravado com a `service_role`.

| Rota | Resposta |
|---|---|
| `POST /uploads` | `201 { demoId, uploadUrl }`. `429` no limite diário, `403` sem e-mail confirmado ou conta suspensa |
| `PUT <uploadUrl>` | Corpo: o zip, com `Content-Length`. Vale 10 minutos. `413` acima de 25 MB, `409` se já enviado |
| `POST /uploads/:demoId/complete` | `202`. Enfileira a validação; o resultado vai para `demos.status` |
| `POST /embed-check` `{ url }` | `{ embeddable, reason? }` (pré-checagem do formulário) |
| `POST /demos/:demoId/verify` | `{ embeddable, reason? }` e grava `live`/`unavailable` na demo `web_link` |

CORS liberado só para as origens de `FRAME_ANCESTORS` (padrão: `SITE_URL`).

### Resultado do zip

- Válido: arquivos em `demos/<demo_id>/<versão>/`, `status = 'live'`, `storage_prefix` preenchido.
- Recusado: `status = 'unavailable'` e `rejection_reason` com um destes códigos: `too_large`, `not_a_zip`, `unsupported_zip`, `encrypted`, `too_many_files`, `unsafe_path`, `symlink`, `extension_not_allowed`, `duplicate_path`, `no_index`, `too_big_uncompressed`, `corrupt`.

Limites: 25 MB compactado, 500 arquivos, 100 MB descompactado, `index.html` na raiz ou numa única pasta. `__MACOSX/`, `.DS_Store` e `Thumbs.db` são ignorados. Extensões aceitas: veja `src/content-types.ts`.

### Motivos da checagem de embed

`invalid_url`, `not_https`, `unsafe` (Google Safe Browsing, só com `SAFE_BROWSING_API_KEY`), `unreachable`, `http_error`, `too_many_redirects`, `x_frame_options`, `csp_frame_ancestors`.

## Entrega das demos

- HTML só com `Sec-Fetch-Dest: iframe` (ou `frame`). Aberto direto, qualquer arquivo redireciona para `SITE_URL/demo/<id>`.
- `Content-Security-Policy: frame-ancestors <FRAME_ANCESTORS>` e `X-Content-Type-Options: nosniff` em tudo.
- Registro de service worker é recusado (403).
- Rota sem extensão que não existe recebe o `index.html` (SPAs).
- O status da demo é lido do Supabase com a chave anon e guardado por 30 s: uma demo bloqueada pela moderação sai do ar em até 30 s.

## Checagem diária

O cron (`0 6 * * *`, 03:00 em São Paulo) enfileira os links `live` e `unavailable` na fila `demo-links`. Link que passa de `live` para `unavailable` gera a notificação `demo_unavailable` para o autor do projeto (gatilho no banco).

## Variáveis

| Nome | Tipo | Exemplo |
|---|---|---|
| `DEMOS_HOST` | var | `devsync-demos.app` |
| `SITE_URL` | var | `https://devsync.app` |
| `FRAME_ANCESTORS` | var (opcional) | `https://devsync.app https://devsync.vercel.app` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | var | painel do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | segredo | painel do Supabase |
| `UPLOAD_SIGNING_SECRET` | segredo | `openssl rand -hex 32` |
| `SAFE_BROWSING_API_KEY` | segredo (opcional) | chave grátis do Google Cloud |

Bindings: R2 `DEMOS_BUCKET` (`devsync-demos`), filas `demo-zips` e `demo-links`.

## Antes de publicar

Nada foi publicado na conta Cloudflare. Para o lançamento:

1. Domínio próprio com rota curinga para o Worker.
2. Workers Paid (US$ 5/mês): descompactar um zip grande passa do limite de CPU do plano grátis (10 ms por pedido).
3. `wrangler r2 bucket create devsync-demos`, `wrangler queues create demo-zips`, `wrangler queues create demo-links`, segredos com `wrangler secret put`.
4. Aplicar a migration `20261123000900_demo_service.sql` no Supabase.
