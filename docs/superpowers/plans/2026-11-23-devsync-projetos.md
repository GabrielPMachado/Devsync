# Projetos (subprojeto 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** publicar projeto com demo (zip ou link), página do projeto, `<DemoOverlay>` por cima da página, curtidas e comentários.

**Architecture:** páginas do App Router (Server Components com leitura em `<Suspense>`), mutações em Server Actions com o cliente Supabase do usuário (a RLS decide). O envio do zip e as checagens de link são chamadas do navegador ao Worker `workers/demos` com o access token do Supabase. A camada de demo é um componente cliente aberto pelo parâmetro `?demo=<id>`.

**Tech Stack:** Next.js 16 (cacheComponents), React 19, Supabase JS, next-intl, Tailwind 4, Vitest + Testing Library, Playwright, wrangler dev (Worker local), `react-markdown` + `remark-gfm`.

**Spec:** `docs/superpowers/specs/2026-11-23-devsync-projetos-design.md` (e a seção 5.3 de `2026-11-23-devsync-arquitetura-design.md`).

## Global Constraints

- Textos só em `messages/pt-BR.json` (next-intl). Nada de texto solto em componente.
- Demo nunca abre em outra guia: nenhum `target="_blank"` nem `window.open` ligados à demo.
- Iframe: `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"`, sem `allow-top-navigation`.
- Demo enviada servida de `<protocolo>//<demo_id>.<host de NEXT_PUBLIC_DEMOS_URL>/`.
- Leitura de sessão só dentro de `<Suspense>` e depois de `connection()` (Next 16 com cacheComponents).
- Limites do banco: título 3 a 120 caracteres, descrição até 20 000, até 5 tags (spec da tela: de 1 a 5), URLs `https://`.
- Zip: até 25 MB (conferir antes de enviar).
- Nenhuma migration nova; nada aplicado no Supabase remoto nem publicado na Cloudflare.

## Review Focus

1. Zip recusado pelo Worker (ex.: `no_index`): o formulário mostra o motivo traduzido e nenhum projeto é criado. → teste em Task 3 (`waitForDemo` devolve `unavailable` + motivo) e Task 4 (mensagem).
2. Demo some para o visitante (bloqueada pela moderação ou apagada): a camada mostra estado "indisponível", nunca iframe vazio. → teste em Task 5 (estado `missing`).
3. Validação que passa do tempo (fila parada): depois de 90 s o formulário avisa e deixa tentar de novo. → teste em Task 3 (`timeout`).
4. Usuário deslogado tentando curtir/comentar: vai para `/entrar?next=<página>`. → teste em Task 6.
5. Resposta a uma resposta: fica no 2º nível (o banco pendura na raiz); a árvore não quebra com pai ausente. → teste em Task 6 (`buildCommentTree`).

---

### Task 1: Regras e URLs da demo

**Files:**
- Create: `src/lib/demos/url.ts`, `src/lib/demos/url.test.ts`, `src/lib/demos/reasons.ts`, `src/lib/demos/reasons.test.ts`, `src/lib/projects/rules.ts`, `src/lib/projects/rules.test.ts`
- Modify: `.env.example` (troca `DEMOS_HOST` por `NEXT_PUBLIC_DEMOS_URL=` com comentário "Local: http://demos.localhost:8787")

**Interfaces — Produces:**
- `demosBaseUrl(raw = process.env.NEXT_PUBLIC_DEMOS_URL): URL | null`
- `demoFrameSrc(demo: { id: string; kind: DemoKind; url: string | null }, base: URL | null): string | null` — `web_upload` → `${base.protocol}//${id}.${base.host}/`; `web_link` → `url`; outros → `null`.
- `type DemoKind = "web_link" | "web_upload" | "sandbox" | "mobile"`; `type DemoStatus = "pending" | "live" | "blocked" | "unavailable"`
- `REJECTION_REASONS` (lista dos códigos do README do Worker + dos motivos de embed) e `reasonKey(code: string | null | undefined): string` → o próprio código se conhecido, senão `"unknown"`.
- `ZIP_MAX_BYTES = 25 * 1024 * 1024`
- `validateProject(input: ProjectInput): { ok: true; value: ProjectInput } | { ok: false; errors: ProjectErrors }` com `ProjectInput = { title; description; tags: string[]; repoUrl: string; siteUrl: string }` (strings já aparadas, tags sem repetição, minúsculas); `ProjectErrors` com chaves `title: "length"`, `description: "tooLong"`, `tags: "min" | "max"`, `repoUrl | siteUrl: "https"`.

- [ ] Testes: `demoFrameSrc` para upload com base `http://demos.localhost:8787` → `http://<id>.demos.localhost:8787/`; link → a URL; base nula com upload → `null`. `reasonKey("no_index") === "no_index"`, `reasonKey("xyz") === "unknown"`. `validateProject`: título "ab" → `length`; 0 tags → `min`; 6 → `max`; repo `http://x` → `https`; vazio em repo/site é ok.
- [ ] Rodar (falha), implementar, rodar (passa): `npx vitest run src/lib/demos src/lib/projects`
- [ ] Commit `feat(projetos): regras do formulário e URLs da demo`

### Task 2: Cliente do serviço de demos (navegador)

**Files:** Create `src/lib/demos/client.ts`, `src/lib/demos/client.test.ts`

**Interfaces — Produces** (todas recebem `{ base: URL; token: string; fetch?: typeof fetch }`):
- `class DemoServiceError extends Error { status: number }`
- `createUpload(o) → Promise<{ demoId: string; uploadUrl: string }>` (`POST /uploads`)
- `putZip(uploadUrl: string, file: Blob, f?: typeof fetch) → Promise<void>` (`PUT`, corpo = arquivo)
- `completeUpload(o, demoId) → Promise<void>` (`POST /uploads/:id/complete`, espera 202)
- `embedCheck(o, url) → Promise<{ embeddable: boolean; reason?: string }>`
- `verifyDemo(o, demoId) → Promise<{ embeddable: boolean; reason?: string }>`
- `waitForDemo(read: () => Promise<{ status: DemoStatus; rejection_reason: string | null } | null>, opts?: { intervalMs?: number; timeoutMs?: number; sleep?: (ms) => Promise<void>; now?: () => number }) → Promise<{ status: "live" } | { status: "unavailable"; reason: string | null } | { status: "timeout" }>` — padrão 1 500 ms / 90 000 ms.

- [ ] Testes com `fetch` falso: cabeçalho `Authorization: Bearer t`; 429 vira `DemoServiceError` com `status 429` e a mensagem do corpo `{error}`; `waitForDemo` com `pending, pending, live` → `live`; com `unavailable/no_index` → motivo; com relógio falso passando de 90 s → `timeout`.
- [ ] Rodar, implementar, rodar: `npx vitest run src/lib/demos/client.test.ts`
- [ ] Commit `feat(projetos): cliente do serviço de demos`

### Task 3: Consultas e Server Actions de projeto

**Files:**
- Create: `src/lib/projects/queries.ts` (server-only), `src/app/(app)/projetos/actions.ts`, `src/app/(app)/projetos/actions.test.ts`, `src/lib/comments/tree.ts`, `src/lib/comments/tree.test.ts`

**Interfaces — Produces:**
- `type ProjectCardData = { id; slug; title; description; likesCount; commentsCount; createdAt; author: { username; displayName; avatarUrl }; tags: string[]; demo: { id; kind; status; url } | null }`
- `listProjects(limit = 30): Promise<ProjectCardData[]>`; `getProject(slug): Promise<(ProjectCardData & { descriptionMd; repoUrl; siteUrl; authorId; demoVersion: number | null }) | null>`; `getComments(projectId): Promise<CommentRow[]>`; `hasLiked(projectId, viewerId): Promise<boolean>`; `listTags(): Promise<{ slug; name }[]>`
- `type CommentRow = { id; parentId: string | null; bodyMd; createdAt; author: {...} ; authorId }`; `buildCommentTree(rows: CommentRow[]): (CommentRow & { replies: CommentRow[] })[]` — raízes em ordem de criação; resposta cujo pai não veio fica como raiz.
- Actions: `publishProject(input: ProjectInput & { demoId: string }): Promise<{ error: "invalid" | "demo" | "unknown"; errors?: ProjectErrors } | never>` → insere `projects` (com `demo_id`) e `project_tags`, e `redirect('/projetos/<slug>?publicado=1')`. Erro `42501` do gatilho de dono da demo → `"demo"`.
- `toggleLike(projectId: string, path: string): Promise<{ liked: boolean; count: number }>`; `addComment(projectId, body, parentId: string | null, path): Promise<{ error?: "empty" | "tooLong" | "unknown" }>`; `deleteComment(id, path)`. Sem sessão → `redirect('/entrar?next=' + path)`. Depois de mudar: `revalidatePath(path)`. Corpo do comentário: 1 a 5 000 caracteres.

- [ ] Testes (Supabase falso, como `boas-vindas/actions.test.ts`): publicar com título curto devolve `invalid` sem tocar no banco; publicar ok insere tags pelos ids e redireciona; erro `42501` → `demo`; `toggleLike` sem viewer redireciona para `/entrar?next=%2Fprojetos%2Fx`; comentário vazio → `empty`. `buildCommentTree` com resposta e pai ausente.
- [ ] Rodar, implementar, rodar: `npx vitest run src/app/\(app\)/projetos src/lib/comments`
- [ ] Commit `feat(projetos): consultas e ações (publicar, curtir, comentar)`

### Task 4: Formulário "Publicar projeto"

**Files:** Create `src/app/(app)/projetos/novo/page.tsx`, `src/components/projects/publish-form.tsx`, `src/components/projects/publish-form.test.tsx`; Modify `src/components/shell/app-shell.tsx` (Publicar → `/projetos/novo`), `messages/pt-BR.json` (`Publish`, `Demo.reasons`)

Tela 05 do Figma: 3 cartões numerados (Sobre, Demo, Links), opções "Enviar arquivos" / "Link do site", área de envio ("Arraste o .zip aqui ou escolha um arquivo", "Até 25 MB · até 500 arquivos · index.html na raiz"), estado "Validando…" com as 3 etapas, aviso de link bloqueado com as duas saídas, botão "Publicar projeto"/"Publicando…". A página exige login (Gate `area="app"` + redirecionamento para `/entrar?next=/projetos/novo`).

- [ ] Testes do componente (ações e cliente de demos mockados): zip acima de 25 MB mostra erro sem chamar o Worker; zip recusado (`no_index`) mostra "Não achamos o index.html…" e não chama `publishProject`; link bloqueado (`x_frame_options`) mostra "Esse link não pode ser usado como demo"; fluxo zip ok chama `publishProject` com o `demoId`.
- [ ] Rodar, implementar, rodar: `npx vitest run src/components/projects/publish-form.test.tsx`
- [ ] Commit `feat(projetos): formulário de publicar com zip ou link`

### Task 5: `<DemoOverlay>` e página `/demo/[id]`

**Files:** Create `src/components/demo/demo-overlay.tsx`, `src/components/demo/demo-overlay.test.tsx`, `src/components/demo/demo-overlay-host.tsx`, `src/components/demo/demo-frame.tsx`, `src/app/demo/[id]/page.tsx`; Modify `src/app/(app)/layout.tsx` (põe `<DemoOverlayHost/>` em `<Suspense>`), `messages/pt-BR.json` (`DemoOverlay`)

**Interfaces — Produces:**
- `DemoOverlay({ demoId, onClose, load? })` — `load(demoId): Promise<DemoView | null>` (padrão: Supabase do navegador lendo `demos` + o projeto com `demo_id`); `DemoView = { id; kind; status; url; project: { title; slug; author: { username; displayName; avatarUrl } } | null }`.
- Estados: carregando; `live` (iframe via `DemoFrame`); `pending` (recarrega a cada 2 s); `unavailable`, `blocked`; `missing` (null) com o texto de indisponível.
- `role="dialog"`, `aria-modal`, `aria-label` = título. Esc, X e clique no fundo chamam `onClose`. Larguras: 100%, 820 px, 390 px. Tela cheia: `requestFullscreen` no elemento da camada. Comentários: link para `/projetos/<slug>#comentarios`.
- `DemoOverlayHost`: lê `?demo=` com `useSearchParams`; fechar = `router.back()` se entrou pela página, senão `router.replace` sem o parâmetro.
- `openDemoHref(pathname, search, demoId): string` (em `demo-overlay-host.tsx`).

- [ ] Testes: `live` renderiza iframe com `sandbox` exato e `src` certo; nenhum `a[target=_blank]`; Esc chama `onClose`; `unavailable`, `blocked` e `missing` mostram os títulos do Figma ("Demo indisponível no momento", "Esta demo foi suspensa"); `pending` mostra "Preparando a demo…".
- [ ] Rodar, implementar, rodar: `npx vitest run src/components/demo`
- [ ] Commit `feat(projetos): camada de demo por cima da página`

### Task 6: Lista, página do projeto, curtidas e comentários

**Files:** Create `src/components/projects/project-card.tsx`, `src/components/projects/like-button.tsx`, `src/components/projects/comments.tsx`, `src/components/projects/markdown.tsx`, `src/app/(app)/projetos/[slug]/page.tsx`, testes `project-card.test.tsx`, `comments.test.tsx`; Modify `src/app/(app)/projetos/page.tsx`, `messages/pt-BR.json` (`Projects`, `Comments`), `package.json` (`react-markdown`, `remark-gfm`)

Card (Figma "Card de projeto"): miniatura com selo de status e botão "Ver demo" (link para `?demo=<id>`, `scroll={false}`), título (2 linhas), descrição, tags, autor, curtidas e comentários. Página (tela 04): trilha, título + selo, autor e data, curtir, prévia da demo com "Abrir demo" e "A demo abre por cima desta página, em tela cheia. Feche com Esc.", Sobre (Markdown), painel "Sobre o projeto" (Código, Site do projeto, Demo "Arquivos enviados · vN" ou "Link", Publicado), Tecnologias, comentários com `id="comentarios"`. Aviso `?publicado=1`: "Projeto publicado! A demo já está no ar.".

- [ ] Testes: card mostra "Ver demo" só com demo `live`, e "Demo indisponível" com `unavailable`; Markdown não renderiza `<script>` nem HTML cru; comentários mostram respostas recuadas e o botão "Responder" só para logados.
- [ ] Rodar, implementar, rodar: `npx vitest run src/components/projects`
- [ ] Commit `feat(projetos): lista, página do projeto, curtidas e comentários`

### Task 7: E2E com o Worker local e CI

**Files:** Create `e2e/projects.spec.ts`, `e2e/helpers/zip.ts` (`makeZip(files: Record<string, string>): Buffer`, zip sem compressão com `zlib.crc32` do Node 22), `e2e/helpers/session.ts` (entrar por link mágico + @usuário, reaproveitando `mailpit.ts`), `scripts/demos-dev-vars.sh`; Modify `playwright.config.ts` (segundo `webServer`: `npm --prefix workers/demos run dev -- --port 8787`, url `http://demos.localhost:8787/x`, aceita 404), `.github/workflows/ci.yml` (instala `workers/demos`, gera `.dev.vars`, `NEXT_PUBLIC_DEMOS_URL` no `.env.local`), `README.md`.

`scripts/demos-dev-vars.sh` escreve `workers/demos/.dev.vars` a partir de `supabase status -o env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_SIGNING_SECRET=e2e-secret`, `SITE_URL=http://localhost:3100`, `FRAME_ANCESTORS=http://localhost:3100`.

- [ ] Teste `publicar com zip e abrir a demo na camada`: entra, vai em Publicar, preenche título/descrição/2 tags, envia o zip com `<h1>Demo E2E</h1>`, clica "Publicar projeto", espera a URL `/projetos/<slug>?publicado=1` e o aviso, clica "Abrir demo", vê `dialog` e `frameLocator('iframe').getByRole('heading', { name: 'Demo E2E' })`, Esc fecha.
- [ ] Teste `curtir e comentar`: no mesmo projeto, curtir muda o contador para 1; comentar e responder aparecem na lista.
- [ ] Rodar: `npm run build && npx playwright test e2e/projects.spec.ts` (passa)
- [ ] Commit `test(projetos): E2E publicar com zip e abrir demo`
