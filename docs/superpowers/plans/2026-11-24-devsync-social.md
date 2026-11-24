# Devsync Social e descoberta: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** perfil com seguir, editar perfil, notificações em tempo real, feed, explorar, busca e página de tag.

**Architecture:** leituras no servidor (Server Components dentro de `<Suspense>`, `connection()` antes do Supabase), escritas por Server Actions com o cliente do usuário (RLS decide). Regras puras (agrupamento de notificações, validação do perfil, parâmetros de busca) em `src/lib/social/*` com testes Vitest. Duas funções SQL novas com testes pgTAP. Realtime só no cliente do sino.

**Tech Stack:** Next.js 16 (cacheComponents), next-intl, Supabase (Postgres, Realtime), Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-devsync-social-design.md`

## Global Constraints

- Todos os textos em `messages/pt-BR.json` (pt-BR). URLs sem prefixo de idioma.
- Sessão só dentro de `<Suspense>`; `await connection()` antes de ler o Supabase.
- Migration nova: `supabase/migrations/20261124100000_social.sql`, só funções `security invoker`, `set search_path = ''`.
- Rotas novas não podem colidir com @usuário (já reservados: `busca`, `explorar`, `configuracoes`, `tags`).

## Review Focus

1. Visitante clicando Seguir: vai para `/entrar?next=/@usuario` e não quebra.
2. Seguir a si mesmo: o botão não aparece no próprio perfil (o banco já recusa).
3. Busca com `q` vazio ou só símbolos (`"`, `-`): mostra estado vazio, sem 500.
4. Link do perfil com `javascript:`: recusado na validação (só `https://`; GitHub só `github.com/<nome>`).
5. Notificação de alvo apagado (projeto/pergunta removidos): some ou mostra texto genérico, sem quebrar a lista.

---

### Task 1: Funções SQL `trending_projects` e `suggested_profiles`

**Files:** Create `supabase/migrations/20261124100000_social.sql`, `supabase/tests/database/10_social.test.sql`. Modify `supabase/README.md` (tabela de funções).

**Interfaces — Produces:**
- `trending_projects(page_size int default 12) returns table(id uuid, score double precision)`
- `suggested_profiles(page_size int default 5) returns table(id uuid)`

- [ ] Teste pgTAP: projeto com 2 curtidas hoje vem antes de projeto com 3 curtidas de 10 dias atrás (fora da janela de 7 dias conta só no desempate); oculto não aparece; `page_size` limitado a 1..50.
- [ ] Teste pgTAP: `suggested_profiles` não traz quem chama, nem já seguidos, nem suspensos, nem sem @; quem tem tecnologia em comum vem primeiro; anon recebe os mais seguidos.
- [ ] Rodar `scripts/test-db.sh supabase/tests/database/10_social.test.sql` (falha), implementar, rodar (passa), commit.

### Task 2: Regras puras de social

**Files:** Create `src/lib/social/notifications.ts` (+test), `src/lib/social/profile-rules.ts` (+test), `src/lib/social/search-params.ts` (+test).

**Interfaces — Produces:**
- `groupNotifications(rows: NotificationRow[]): NotificationGroup[]` — agrupa `like` e `vote` não lidos do mesmo alvo (e lidos do mesmo alvo separadamente); `follow`/`comment`/`answer`/... nunca agrupam. Grupo: `{ key, type, targetType, targetId, actors: Actor[], unread, createdAt (mais novo), ids }`. Ordem: mais novo primeiro.
- `filterFor(tab: "todas" | "respostas" | "seguidores"): NotificationType[] | null` — respostas = answer, accepted, comment, reply; seguidores = follow.
- `validateProfile(input: { displayName: string; bio: string; github: string; site: string; tags: string[] })` → `{ ok: true, value } | { ok: false, errors }`. Nome 1..80, bio ≤ 500, GitHub vazio ou usuário `^[A-Za-z0-9-]{1,39}$` (aceita colar `https://github.com/nome`), site vazio ou URL `https://`/`http://` válida ≤ 200, tags 0..10 slugs válidos.
- `parseSearch(sp: { q?: string; tipo?: string; tag?: string })` → `{ q: string; kinds: ("project"|"question"|"profile")[] | null; tag: string | null; tipo: "tudo"|"projetos"|"perguntas"|"pessoas" }`; `q` aparado e cortado em 200.
- [ ] Testes primeiro (incluindo Review Focus 4), implementar, commit.

### Task 3: Seguir e perfil completo

**Files:** Create `src/app/(app)/u/[username]/actions.ts` (+test), `src/components/social/follow-button.tsx`, `src/lib/social/queries.ts`, `src/app/(app)/u/[username]/seguidores/page.tsx`, `.../seguindo/page.tsx`, `src/components/social/person-row.tsx`. Modify `src/app/(app)/u/[username]/page.tsx`, `src/proxy.ts` (se o rewrite de `/@` precisar cobrir subcaminhos).

**Interfaces — Produces:** `toggleFollow(profileId: string, path: string): Promise<{ following: boolean; followers: number }>`; `<FollowButton profileId following signedIn path size? />`; `<PersonRow person viewerFollows signedIn />`; `getProfileStats(id)`, `isFollowing(viewerId, ids[])`.
- [ ] Teste da action (mock do Supabase como em `projetos/actions.test.ts`): insere quando não segue, apaga quando segue, recusa seguir a si mesmo, visitante redireciona.
- [ ] Perfil: links, números, abas `?aba=projetos|perguntas|respostas`, botão Seguir (Review Focus 1 e 2), link "Editar perfil" no próprio.
- [ ] Commit.

### Task 4: Editar perfil (`/configuracoes`)

**Files:** Create `src/app/(app)/configuracoes/page.tsx`, `actions.ts` (+test), `src/components/social/profile-form.tsx`.
**Interfaces:** `saveProfile(input): Promise<{ errors?: ProfileErrors; error?: "unknown" }>` — atualiza `profiles` (display_name, bio, links) e substitui `profile_tags`; redireciona para `/@usuario?salvo=1`.
- [ ] Testes da action (inválido não grava; tags substituídas), implementar, commit.

### Task 5: Notificações e sino em tempo real

**Files:** Create `src/app/(app)/notificacoes/actions.ts`, `src/components/social/notification-item.tsx`, `src/components/social/notification-bell.tsx` (cliente, Realtime), `src/lib/social/notification-queries.ts`. Modify `notificacoes/page.tsx`, `app-shell.tsx`, `nav-links.tsx` (contador na aba).
**Interfaces:** `markAllRead(): Promise<void>`; `<NotificationBell userId initialUnread />` assina `postgres_changes` INSERT em `notifications` filtrado por `recipient_id=eq.<id>`, incrementa o contador e mostra toast "Nova notificação". `loadNotifications(viewerId, tab)` junta títulos/slugs dos alvos (projeto, pergunta, resposta → pergunta, comentário → alvo).
- [ ] Teste de componente do item (texto agrupado "Ana e mais 4 pessoas curtiram seu projeto X"; alvo ausente → texto genérico, Review Focus 5).
- [ ] Página marca as exibidas como lidas depois de renderizar (action chamada pelo cliente ao montar).
- [ ] Commit.

### Task 6: Início com feed, Explorar, Busca e Tag

**Files:** Create `src/lib/social/feed-queries.ts`, `src/components/social/feed-list.tsx`, `src/components/social/search-box.tsx` (cliente, Ctrl K), `src/app/(app)/explorar/page.tsx`, `src/app/(app)/busca/page.tsx`, `src/app/(app)/tags/[slug]/page.tsx`, `src/app/(app)/tags/actions.ts`, `src/components/social/tag-follow-button.tsx`. Modify `src/app/(app)/page.tsx`, `app-shell.tsx`.
**Interfaces:** `loadFeed(before: string | null): Promise<{ items: FeedItem[]; next: string | null }>` (`FeedItem = { kind: "project", project: ProjectCardData } | { kind: "question", question: QuestionSummary }`); `toggleTagFollow(slug, path)`.
- [ ] Teste do SearchBox (Ctrl K foca, Enter vai para `/busca?q=`); busca vazia mostra estado vazio (Review Focus 3).
- [ ] Commit.

### Task 7: E2E e fechamento

**Files:** Create `e2e/social.spec.ts`. Modify `.github/workflows/ci.yml` (não excluir `realtime`), `messages/pt-BR.json`.
- [ ] E2E: Ana publica pergunta; Bruno segue Ana pelo perfil; Ana vê o contador do sino subir sem recarregar e a notificação "Bruno começou a seguir você"; Bruno vê a pergunta da Ana no Início; Bruno acha Ana na busca.
- [ ] `npm run lint && npm run typecheck && npm test && scripts/test-db.sh`, build, E2E. Commit.
