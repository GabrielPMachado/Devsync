# Serviço de demos (subprojeto 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um Cloudflare Worker que recebe o `.zip` de uma demo, valida e descompacta no R2, serve cada demo num subdomínio próprio só dentro de iframe da Devsync, e checa se links de demo aceitam ser embutidos (na hora e uma vez por dia).

**Architecture:** Pacote isolado em `workers/demos/` (package.json, tsconfig e Vitest próprios; o app Next.js não importa nada dele). Um Worker, três entradas: `fetch` (API no host `DEMOS_HOST` e demos em `<demo_id>.DEMOS_HOST`), `queue` (filas `demo-zips` e `demo-links`) e `scheduled` (cron diário que enfileira os links). O Worker fala com o Supabase por PostgREST com `fetch` puro: chamadas do usuário usam o JWT dele (a RLS e os gatilhos do subprojeto 1 valem: e-mail confirmado, 5 envios/dia, conta suspensa); só o resultado da validação usa a `service_role`. Toda dependência externa (`fetch` de saída, relógio) entra por parâmetro para os testes trocarem.

**Tech Stack:** TypeScript, Cloudflare Workers (wrangler 4), R2, Queues, Cron Triggers, fflate (inflate raw), Vitest 4 + `@cloudflare/vitest-pool-workers` (Miniflare).

**Spec:** `docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md` (5.2, 5.3) e contratos de `docs/superpowers/plans/2026-11-23-devsync-fase-1-roteiro.md`.

## Global Constraints

- Custo US$ 0: nada é publicado na conta Cloudflare nesta fase; tudo roda e é testado local (Miniflare).
- Demo servida só em `https://<demo_id>.<DEMOS_HOST>/`; `DEMOS_HOST` é variável de ambiente.
- Contratos: `POST /uploads` → `{ demoId, uploadUrl }`; `POST /uploads/:demoId/complete` → enfileira, resultado em `demos.status`; `POST /embed-check` `{ url }` → `{ embeddable, reason? }`.
- Enums do banco: `demo_kind` `web_link | web_upload | sandbox | mobile`; `demo_status` `pending | live | blocked | unavailable`.
- Zip: até 25 MB compactado, até 500 arquivos, `index.html` na raiz ou numa única pasta, só extensões de site estático.
- Arquivos em `demos/<demo_id>/<versão>/`.
- CSP `frame-ancestors <SITE_URL>`; HTML só com `Sec-Fetch-Dest: iframe`; fora disso redireciona para `<SITE_URL>/demo/<id>`.
- Demo `blocked` para de ser servida (até 30 s de cache).
- Textos de erro para o usuário em pt-BR.

## Decisões deste plano (desvios conscientes do roteiro)

1. **URL de envio assinada pelo próprio Worker** (HMAC), não pré-assinada do S3 do R2: o PUT passa pelo Worker, que grava no R2 e garante o limite de 25 MB antes de aceitar. Não precisa de chaves S3 e funciona igual no Miniflare.
2. **`POST /demos/:demoId/verify`** (novo): o site não pode escrever `demos.status`, então a publicação de `web_link` pede ao Worker para checar e gravar `live` ou `unavailable`. `/embed-check` continua sendo só a pré-checagem do formulário.
3. **Migration nova** `20261123000900_demo_service.sql`: coluna `demos.rejection_reason text` (motivo de zip recusado; zip recusado vira `unavailable`), valor `demo_unavailable` em `notification_type` e gatilho que avisa o autor de cada projeto com a demo quando um `web_link` passa de `live` para `unavailable`.
4. **Bloqueio de service worker**: pedido com cabeçalho `Service-Worker: script` recebe 403, para uma demo não instalar um service worker que responda à navegação direta sem passar pelo redirecionamento.
5. Safe Browsing só roda se `SAFE_BROWSING_API_KEY` existir (chave grátis, configurada no deploy).
6. Descompactar zip grande passa do limite de CPU do plano grátis de Workers (10 ms). No lançamento o deploy precisa do Workers Paid (US$ 5/mês), dentro do orçamento previsto.

## Review Focus

- Zip com `../`, caminho absoluto, `\`, link simbólico, entrada criptografada, zip64 ou nomes duplicados: recusado com motivo (Task 3).
- Zip bomb (tamanho descompactado declarado gigante ou mentiroso): recusar acima de 100 MB descompactados e conferir o tamanho real ao inflar (Task 3).
- Zip do macOS com `__MACOSX/` e `.DS_Store`: ignorar em silêncio, não recusar (Task 3).
- SPA com rota sem extensão (`/perfil/ana`) recebe o `index.html`; arquivo com extensão que não existe recebe 404 (Task 4).
- Link de demo que redireciona para `http:` ou que só bloqueia via CSP `frame-ancestors` com `'self'`: não embutível (Task 6).

## File Structure

```
workers/demos/
  package.json, tsconfig.json, vitest.config.mts, wrangler.jsonc, README.md
  src/
    index.ts          entradas fetch/queue/scheduled, roteamento por host
    env.ts            tipo Env e leitura das variáveis
    http.ts           json(), erro(), CORS
    supabase.ts       cliente PostgREST mínimo (usuário e service_role)
    signing.ts        HMAC da URL de envio
    zip.ts            leitor de zip (diretório central) + validação
    content-types.ts  extensões permitidas e Content-Type
    serve.ts          entrega das demos (cache de status, Sec-Fetch-Dest, CSP)
    uploads.ts        POST /uploads, PUT do arquivo, POST /complete
    process-zip.ts    consumidor da fila demo-zips
    embed.ts          checagem de embed (XFO, CSP, redirecionamentos, Safe Browsing)
    links.ts          /embed-check, /demos/:id/verify, cron e fila demo-links
  test/               um *.test.ts por arquivo de src, helpers.ts (fake fetch, zips de teste)
supabase/migrations/20261123000900_demo_service.sql
supabase/tests/database/09_demo_service.test.sql
.github/workflows/ci.yml   job novo "Serviço de demos"
```

## Variáveis do Worker

`DEMOS_HOST` (ex.: `demos.localhost`), `SITE_URL` (ex.: `https://devsync.app`), `FRAME_ANCESTORS` (opcional, lista separada por espaço; padrão `SITE_URL`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, segredos `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_SIGNING_SECRET`, `SAFE_BROWSING_API_KEY` (opcional). Bindings: `DEMOS_BUCKET` (R2), `ZIP_QUEUE`, `LINK_QUEUE`.

---

### Task 1: Pacote, Supabase client e migration

**Files:** Create `workers/demos/{package.json,tsconfig.json,vitest.config.mts,wrangler.jsonc}`, `src/{env.ts,http.ts,supabase.ts}`, `test/supabase.test.ts`, `supabase/migrations/20261123000900_demo_service.sql`, `supabase/tests/database/09_demo_service.test.sql`. Modify root `tsconfig.json` (exclude `workers`), `eslint.config.mjs` (ignore `workers/**`).

**Interfaces — Produces:**
- `type Fetch = typeof fetch`
- `getUser(env, token, f): Promise<{ id: string } | null>` (`GET /auth/v1/user`)
- `userRest(env, token, f)` / `serviceRest(env, f)` → `{ select<T>(table, query): Promise<T[]>, insert<T>(table, row): Promise<T>, update(table, query, patch): Promise<void> }`, lançam `SupabaseError { status, code, message }`.
- `json(data, status?, headers?)`, `errorResponse(status, message)`, `withCors(res, origin, env)`.

- [ ] Teste: `insert` envia `apikey` anon + `Authorization: Bearer <token do usuário>` + `Prefer: return=representation`; `serviceRest` usa a service_role nos dois cabeçalhos; erro do PostgREST com `code: "DS001"` vira `SupabaseError` com esse código. Rodar e ver falhar; implementar; passar.
- [ ] pgTAP `09_demo_service`: `rejection_reason` existe e o `authenticated` não pode escrever nela; `live → unavailable` de `web_link` com projeto cria notificação `demo_unavailable` para o autor (target `project`); `pending → unavailable` não notifica; `web_upload` não notifica. Rodar `scripts/test-db.sh supabase/tests/database/09_demo_service.test.sql`, ver falhar, escrever a migration, passar.
- [ ] Commit `feat(demos): pacote do Worker, cliente Supabase e migration do serviço de demos`.

### Task 2: URL de envio assinada

**Files:** `src/signing.ts`, `test/signing.test.ts`.

**Produces:** `signUpload(secret, demoId, version, expiresAt: number): Promise<string>` (hex HMAC-SHA256 de `${demoId}:${version}:${expiresAt}`), `verifyUpload(secret, demoId, version, expiresAt, sig, now): Promise<boolean>` (falso se expirado ou assinatura errada; comparação em tempo constante).

- [ ] Testes: assina e verifica; muda versão → falso; `now > expiresAt` → falso; assinatura com outro segredo → falso. TDD, commit.

### Task 3: Leitor e validação de zip

**Files:** `src/zip.ts`, `src/content-types.ts`, `test/zip.test.ts`, `test/helpers.ts` (monta zips de teste byte a byte, com controle de atributos externos e flags).

**Produces:**
- `ALLOWED_EXTENSIONS` e `contentTypeFor(path): string`.
- `LIMITS = { maxZipBytes: 25 * 1024 * 1024, maxFiles: 500, maxTotalBytes: 100 * 1024 * 1024 }`.
- `readDemoZip(bytes: Uint8Array): { ok: true, files: { path: string, data: Uint8Array }[] } | { ok: false, reason: ZipRejection }` com `ZipRejection = 'too_large' | 'not_a_zip' | 'unsupported_zip' | 'encrypted' | 'too_many_files' | 'unsafe_path' | 'symlink' | 'extension_not_allowed' | 'duplicate_path' | 'no_index' | 'too_big_uncompressed' | 'corrupt'`.
- Algoritmo: achar EOCD, ler diretório central (nome, método 0/8, flags, tamanhos, atributo externo, offset), recusar antes de inflar; pular `__MACOSX/`, `.DS_Store`, `Thumbs.db` e diretórios; tirar a pasta única de topo se `index.html` não estiver na raiz e todos os arquivos estiverem nela; inflar com `inflateSync` do fflate e conferir o tamanho real com o declarado e o CRC-32.

- [ ] Testes, um por motivo: zip válido na raiz; válido numa pasta `dist/` (prefixo removido); `../x.js`, `/etc/x`, `a\\b.js` → `unsafe_path`; atributo unix `0o120777` → `symlink`; `x.php` → `extension_not_allowed`; 501 arquivos → `too_many_files`; sem `index.html` → `no_index`; `index.html` em duas pastas → `no_index`; flag de criptografia → `encrypted`; tamanho declarado 200 MB → `too_big_uncompressed`; tamanho declarado menor que o real → `corrupt`; bytes aleatórios → `not_a_zip`; `__MACOSX/._index.html` ignorado. TDD, commit.

### Task 4: Entrega das demos

**Files:** `src/serve.ts`, `src/index.ts` (roteamento), `test/serve.test.ts`.

**Consumes:** `serviceRest`/`userRest` (consulta anônima: `GET demos?id=eq.<id>&select=id,kind,status,storage_prefix` com a chave anon; a RLS só devolve `live`/`unavailable`), `contentTypeFor`.

**Produces:** `serveDemo(req, env, demoId, deps: { fetch, now }): Promise<Response>`, `parseDemoHost(hostname, demosHost): string | null` (só UUID), `clearDemoCache()`.

- [ ] Testes (R2 real do Miniflare): `Sec-Fetch-Dest: iframe` em `/` → 200 HTML com `Content-Security-Policy: frame-ancestors https://devsync.app`, `X-Content-Type-Options: nosniff`; `Sec-Fetch-Dest: document` → 302 para `https://devsync.app/demo/<id>`; HTML sem `Sec-Fetch-Dest` → 302; `script` em `/assets/a.js` → 200 `text/javascript`; `Sec-Fetch-Dest: document` em `/logo.svg` → 302; `Service-Worker: script` → 403; `/perfil/ana` → `index.html`; `/nao-existe.png` → 404; demo que a consulta não devolve (blocked) → 404 com página curta "Demo indisponível"; status lido de novo após 30 s, não antes; host não-UUID → 404; `/%2e%2e/x` → 404. TDD, commit.

### Task 5: Envio e fila de validação

**Files:** `src/uploads.ts`, `src/process-zip.ts`, `test/uploads.test.ts`, `test/process-zip.test.ts`.

**Produces:**
- `POST /uploads` (Bearer do usuário): `getUser`; `insert demos {kind:'web_upload'}` com o JWT; resposta 201 `{ demoId, uploadUrl }`, `uploadUrl = https://<DEMOS_HOST>/uploads/<id>/1?expires=<ms>&sig=<hex>` (10 min). `DS001` → 429, `DS002` → 403, sem token → 401.
- `PUT /uploads/:demoId/:version?expires&sig`: assinatura válida; `Content-Length` obrigatório e ≤ 25 MB (senão 413); objeto já existe → 409; grava `uploads/<id>/<v>.zip`.
- `POST /uploads/:demoId/complete` (Bearer): demo do usuário, `web_upload`, `pending`; zip existe no R2 (senão 409); envia `{ demoId, version }` para `ZIP_QUEUE`; 202.
- `processZip(msg, env, deps)`: lê o zip; `readDemoZip`; ok → grava cada arquivo em `demos/<id>/<v>/<path>` com `contentType`, atualiza `{status:'live', storage_prefix:'demos/<id>/<v>/', version, rejection_reason:null}` via service_role; recusa → `{status:'unavailable', rejection_reason}`; apaga o zip enviado nos dois casos. Demo que já não está `pending` (apagada ou bloqueada) → só apaga o zip.
- [ ] Testes de cada linha acima (fake fetch registra as chamadas ao Supabase), incluindo: assinatura expirada → 403; `complete` de demo de outra pessoa → 404; zip inválido → `unavailable` + `rejection_reason: 'unsafe_path'` e nenhum arquivo em `demos/`. TDD, commit.

### Task 6: Checagem de embed

**Files:** `src/embed.ts`, `test/embed.test.ts`.

**Produces:** `checkEmbeddable(url: string, siteUrl: string, deps: { fetch, safeBrowsingKey? }): Promise<{ embeddable: boolean, reason?: EmbedReason }>`, `EmbedReason = 'invalid_url' | 'not_https' | 'unsafe' | 'unreachable' | 'http_error' | 'too_many_redirects' | 'x_frame_options' | 'csp_frame_ancestors'`.

Regras: só `https:`, sem IP literal, `localhost` ou porta; segue até 5 redirecionamentos manuais, cada um `https`; timeout 10 s; resposta final 2xx. Se algum `Content-Security-Policy` tiver `frame-ancestors`, ele decide (cada política precisa permitir `siteUrl`: `*`, `https:`, origem exata ou `https://*.dominio`; `'none'`/`'self'` negam) e o `X-Frame-Options` é ignorado; senão `X-Frame-Options` `DENY`/`SAMEORIGIN` nega e valores desconhecidos são ignorados.

- [ ] Testes: sem cabeçalhos → embutível; `XFO: DENY`, `SAMEORIGIN` → `x_frame_options`; `frame-ancestors 'self'` → `csp_frame_ancestors`; `frame-ancestors https://devsync.app` com `XFO: DENY` → embutível; `frame-ancestors https://*.devsync.app` não cobre `https://devsync.app`; duas CSPs, uma negando → nega; `http://` → `not_https`; redireciona para `http:` → `not_https`; 6 redirecionamentos → `too_many_redirects`; 404 → `http_error`; fetch lança → `unreachable`; Safe Browsing com match → `unsafe`; `https://127.0.0.1` → `invalid_url`. TDD, commit.

### Task 7: Rotas de link, cron diário e CI

**Files:** `src/links.ts`, `src/index.ts`, `test/links.test.ts`, `test/index.test.ts`, `.github/workflows/ci.yml`, `workers/demos/README.md`, `.env.example`, roteiro (contrato novo).

**Produces:**
- `POST /embed-check` (Bearer) → `checkEmbeddable`.
- `POST /demos/:demoId/verify` (Bearer): demo do usuário, `web_link`, não `blocked`; checa e grava `{status: live|unavailable, embeddable, checked_at}` via service_role; devolve `{ embeddable, reason? }`.
- `scheduled`: lista `web_link` em `live`/`unavailable` (ordem `checked_at.asc.nullsfirst`, até 1000) e envia em lotes de 100 para `LINK_QUEUE`.
- `queue` `demo-links`: rechecagem; grava só se ainda não estiver `blocked` (filtro `status=neq.blocked` no PATCH).
- CORS na API para as origens de `FRAME_ANCESTORS` (`OPTIONS` → 204).
- [ ] Testes: `/embed-check` sem token → 401; verify grava `live`; verify de link que passou a bloquear grava `unavailable`; cron envia 2 lotes para 150 demos; consumidor não sobrescreve `blocked`; `OPTIONS /uploads` com origem permitida → 204 com `Access-Control-Allow-Origin`; origem estranha → sem o cabeçalho. Integração pelo `SELF`: zip válido de ponta a ponta (POST /uploads → PUT → complete → fila → demo servida no iframe).
- [ ] CI: job `demos` (`npm ci`, `npm run typecheck`, `npm test` em `workers/demos`) e job `db` rodando `scripts/test-db.sh` se for viável instalar pgtap no runner.
- [ ] Commit, revisão de código, PR.
