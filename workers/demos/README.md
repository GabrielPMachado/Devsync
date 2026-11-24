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
| `POST /builds` `{ repo, ref? }` | `201 { demoId, buildId }`. Build automático (abaixo). `503` sem `BUILDER_REPO`/`BUILDER_GITHUB_TOKEN`, `404` repo inexistente, `400` privado, `413` acima de 200 MB, `429`/`403` como em `/uploads` |
| `POST /builds/:id/progress` | Só o run de build (token OIDC). `{ stage, error?, log?, framework? }` |
| `PUT /builds/:id/zip` | Só o run de build (token OIDC). Corpo: o zip. `202` e segue a validação dos zips |

### Build automático

O site chama `POST /builds`; o Worker cria a demo como o usuário, grava `demo_builds` e dispara o workflow `build-demo.yml` de `BUILDER_REPO`. O run (ver [`builder/README.md`](../../builder/README.md)) avisa cada etapa e envia o zip com o **token OIDC do GitHub Actions** (audiência `devsync-builds`). O Worker confere a assinatura (chaves de `token.actions.githubusercontent.com`), o repositório, o workflow na `main` e o evento `workflow_dispatch`, e prende o build ao primeiro `run_id` que falar com ele. Com `BUILDER_REPO_ID`, confere também o id do repositório. Chave desconhecida recarrega as chaves do GitHub no máximo uma vez por minuto. Um cron a cada 15 min encerra builds sem notícia há 40 min (`stalled`). As rotas do run ficam fora do limite por IP. Falha marca a demo `unavailable` com `rejection_reason = 'build_failed'`; o resultado da validação do zip fecha o build (gatilho `demos_sync_build`).

CORS liberado só para as origens de `FRAME_ANCESTORS` (padrão: `SITE_URL`).

### Resultado do zip

- Válido: arquivos em `demos/<demo_id>/<versão>/`, `status = 'live'`, `storage_prefix` preenchido.
- Recusado: `status = 'unavailable'` e `rejection_reason` com um destes códigos: `too_large`, `not_a_zip`, `unsupported_zip`, `encrypted`, `too_many_files`, `unsafe_path`, `symlink`, `extension_not_allowed`, `duplicate_path`, `no_index`, `too_big_uncompressed`, `corrupt`.

Limites: 25 MB compactado, 500 arquivos, 60 MB descompactado (cabe na memória do isolate), `index.html` na raiz ou numa única pasta. `__MACOSX/`, `.DS_Store` e `Thumbs.db` são ignorados. Extensões aceitas: veja `src/content-types.ts`.

### Motivos da checagem de embed

`invalid_url`, `not_https`, `unsafe` (Google Safe Browsing em todos os endereços do caminho, só com `SAFE_BROWSING_API_KEY`; se a API falhar, a checagem segue), `unreachable`, `http_error`, `too_many_redirects`, `x_frame_options`, `csp_frame_ancestors`.

## Entrega das demos

- HTML só com `Sec-Fetch-Dest: iframe` (ou `frame`). Aberto direto, qualquer arquivo redireciona para `SITE_URL/demo/<id>`.
- `Content-Security-Policy: frame-ancestors <FRAME_ANCESTORS>` e `X-Content-Type-Options: nosniff` em tudo.
- Arquivos que não são HTML levam também `sandbox` na CSP: um SVG aberto fora de iframe não roda script.
- Registro de service worker é recusado (403).
- Rota sem extensão que não existe recebe o `index.html` (SPAs).
- O status da demo é lido do Supabase com a chave anon e guardado por 30 s: uma demo bloqueada pela moderação sai do ar em até 30 s.

### Riscos conhecidos

- O iframe da spec tem `allow-popups`: uma demo pode abrir uma janela nova e escrever HTML nela com a origem da demo, sem passar pelo redirecionamento. Fica como está porque muitas demos abrem links; reavaliar se aparecer abuso (tirar `allow-popups` ou usar `allow-popups-to-escape-sandbox` sem `allow-same-origin`).
- Limite de chamadas: em produção, 30 chamadas da API por minuto por IP (binding `API_LIMITER`), com `429` e `Retry-After: 60`. Fora de produção (dev e testes) não há limite. O limite de 5 envios por dia continua valendo na criação.
- Zips enviados e não concluídos ficam em `uploads/`: configurar uma regra de ciclo de vida no R2 (apagar após 1 dia).

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
| `BUILDER_REPO` | segredo/var (opcional) | `GabrielPMachado/devsync-builds` |
| `BUILDER_REPO_ID` | segredo/var (opcional, recomendado) | id numérico do `BUILDER_REPO` (`https://api.github.com/repos/<repo>` → `id`) |
| `BUILDER_GITHUB_TOKEN` | segredo (opcional) | token fine-grained, só o `BUILDER_REPO`, Actions: write |

Bindings: R2 `DEMOS_BUCKET` (`devsync-demos`), filas `demo-zips` e `demo-links`.

## Publicar

Nada foi publicado na conta Cloudflare ainda. A configuração de produção está pronta em `wrangler.jsonc` (`env.production`) e a publicação é feita pelo workflow **Publicar serviço de demos** (`.github/workflows/deploy-demos.yml`), rodado à mão no GitHub. O passo a passo completo, com o que comprar, está em [`docs/lancamento.md`](../../docs/lancamento.md).

Resumo do que precisa existir antes:

1. Domínio próprio na Cloudflare, com DNS curinga `*` (e o raiz) com proxy ligado. O workflow troca `DOMINIO_DAS_DEMOS` por ele.
2. Workers Paid (US$ 5/mês): filas e descompactar zip grande (limite de CPU e de subrequests do grátis).
3. Segredos e a variável `DEMOS_DOMAIN` no GitHub. Na primeira vez, marque "Criar bucket R2 e filas".
4. No site (Vercel): `NEXT_PUBLIC_DEMOS_URL=https://<domínio>` e um novo deploy (a CSP do site libera o domínio das demos no build).
