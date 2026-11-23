# Login e layout da Devsync (subprojeto 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** login de ponta a ponta (GitHub + link mágico), escolha do @usuário no primeiro acesso e o layout do site (barra de cima no desktop, barra de cima + abas embaixo no celular), seguindo as telas 01, 01b, 01c e as barras do Figma aprovado.

**Architecture:** Supabase Auth com `@supabase/ssr` e sessão em cookie. O link mágico usa o fluxo `token_hash` (o e-mail aponta para `/auth/confirmar`, que chama `verifyOtp`), então funciona até se for aberto em outro aparelho. O GitHub usa PKCE (`/auth/callback` chama `exchangeCodeForSession`). As regras de quem vai para onde ficam numa função pura (`routeFor`) usada pelos layouts de servidor. Desenvolvimento e E2E contra o Supabase local (CLI + Docker, e-mails no Mailpit).

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Tailwind 4 com os tokens, next-intl, `@supabase/ssr`, `lucide-react` (ícones, ISC, os mesmos do Figma), Vitest, Playwright, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md` (5.7 e 5.9) e o roteiro `docs/superpowers/plans/2026-11-23-devsync-fase-1-roteiro.md` (subprojeto 2).

## Global Constraints

- Todos os textos em `messages/pt-BR.json` (next-intl). URLs sem prefixo de idioma, em português.
- Só tokens semânticos do tema (`bg-bg-surface`, `text-text-muted`...). Gradiente só em destaques.
- Sem Supabase configurado o site continua abrindo (visitante), como hoje.
- Nenhuma migração aplicada no Supabase remoto. Custo US$ 0.
- `@usuário`: `^[a-z0-9_]{3,30}$`, sem os reservados do banco (`admin, api, perguntas, projetos, demo, u, tags, busca, explorar, configuracoes, login, devsync, suporte, en`), único sem diferenciar maiúsculas.

## Review Focus

1. `next` com endereço externo (`//evil.com`, `https://evil.com`, `/\evil.com`) depois do login: tem que voltar para `/`. Teste em `safe-next.test.ts`.
2. @usuário digitado com maiúsculas, espaços ou `@` na frente: normaliza (`" @Gabriel "` → `gabriel`) antes de validar. Teste em `username.test.ts`.
3. Dois usuários escolhendo o mesmo @ ao mesmo tempo: a violação de unicidade (`23505`) vira a mensagem "já está em uso", não erro 500. Teste em `onboarding-actions.test.ts`.
4. Link mágico vencido ou já usado: `/auth/confirmar` manda para `/entrar?erro=link` com aviso, não tela de erro. E2E.
5. Usuário logado sem @usuário tentando abrir qualquer página do app: vai para `/boas-vindas`; com @usuário, `/entrar` e `/boas-vindas` mandam para `/`. Teste em `route-for.test.ts` + E2E.

---

### Task 1: Regras puras de auth

**Files:** Create `src/lib/auth/username.ts`, `src/lib/auth/safe-next.ts`, `src/lib/auth/route-for.ts` + testes `*.test.ts` ao lado.

**Interfaces (Produces):**
- `normalizeUsername(raw: string): string` (trim, tira `@` inicial, minúsculas)
- `validateUsername(raw: string): { ok: true; username: string } | { ok: false; reason: "short" | "long" | "chars" | "reserved" }`
- `RESERVED_USERNAMES: readonly string[]` (mesma lista da migração)
- `safeNext(next: string | null | undefined, fallback = "/"): string`
- `routeFor(area: "auth" | "onboarding" | "app" | "private", viewer: { username: string | null } | null, next?: string): string | null` (null = pode ficar; `private` = páginas do app que exigem login)

- [ ] Testes: reservados recusados; `"ab"` short; 31 chars long; `"gab-riel"` chars; `" @Gabriel "` ok → `gabriel`; `safeNext` recusa `//x`, `https://x`, `/\x`, `javascript:`; aceita `/u/ana?x=1`; `routeFor`: visitante em `onboarding`/`private` → `/entrar?next=...`; logado sem @ em `app`/`auth` → `/boas-vindas`; com @ em `auth`/`onboarding` → `next` seguro ou `/`.
- [ ] Implementar, rodar `npx vitest run src/lib/auth`, commit.

### Task 2: Supabase local, e-mail em pt-BR e bucket de avatares

**Files:** Modify `supabase/config.toml` (auth: `site_url`, `additional_redirect_urls` para 3000 e 3100, GitHub com `env(SUPABASE_AUTH_GITHUB_CLIENT_ID)`/`env(SUPABASE_AUTH_GITHUB_SECRET)`, `rate_limit.email_sent = 100`, templates); Create `supabase/templates/magic_link.html` e `confirmation.html` (link `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`, ou `?` quando o RedirectTo não tiver query: o site sempre manda `?next=`); Create migração `supabase/migrations/20261123000900_avatars_bucket.sql` (bucket público `avatars`, 2 MB, `image/png|jpeg|webp|gif`; insert/update/delete só em `<auth.uid()>/...`); teste pgTAP `09_avatars.test.sql` (roda só com Supabase CLI, porque o shim não tem `storage`: o arquivo pula se `storage.buckets` não existir); `.env.example` ganha `NEXT_PUBLIC_SITE_URL`, `SUPABASE_AUTH_GITHUB_CLIENT_ID`, `SUPABASE_AUTH_GITHUB_SECRET`.

- [ ] `supabase db reset` aplica tudo; `supabase test db` passa.

### Task 3: Componentes de interface e logo

**Files:** Create `src/components/ui/button.tsx` (`Button` e `buttonClasses({ variant: "primary" | "secondary" | "ghost", size: "sm" | "md" | "lg", full?: boolean })`), `src/components/ui/text-field.tsx` (`TextField` com label, help, erro ligado por `aria-describedby`), `src/components/ui/avatar.tsx` (`Avatar({ src, name, size })`, iniciais quando não há foto), `src/components/ui/tag-chip.tsx`, `src/components/brand/logo.tsx` (`Logo({ size, withWordmark })`, SVG com `<>` em quadrado arredondado azul→ciano), `src/components/icons/github.tsx`. Adiciona `lucide-react`.

- [ ] Testes de unidade: Avatar mostra iniciais `GM` para "Gabriel Machado" sem foto; TextField liga o erro ao input (`toHaveAccessibleDescription`).

### Task 4: Entrar (GitHub + link mágico) e rotas de retorno

**Files:** Create `src/lib/site-url.ts` (`siteUrl(headers): string`: `NEXT_PUBLIC_SITE_URL` ou origem do pedido), `src/lib/auth/viewer.ts` (`getViewer(): Promise<Viewer | null>`, com `cache`, `Viewer = { id; email: string | null; username: string | null; displayName: string | null; avatarUrl: string | null }`), `src/app/(auth)/layout.tsx`, `src/app/(auth)/entrar/page.tsx`, `src/app/(auth)/entrar/actions.ts` (`signInWithGithub(formData)`, `sendMagicLink(prev, formData): Promise<{ status: "idle" | "sent" | "error"; email?: string; error?: "email" | "rate" | "unknown" }>`), `src/components/auth/brand-panel.tsx`, `src/components/auth/login-card.tsx` (cliente: formulário ↔ "Confira seu e-mail" com reenviar em 60 s e "Usar outro e-mail"), `src/app/auth/callback/route.ts`, `src/app/auth/confirmar/route.ts`, `src/app/auth/sair/route.ts` (POST: `signOut` e volta para `/`).

- [ ] Teste de unidade de `sendMagicLink`: e-mail inválido → `error: "email"` sem chamar o Supabase; erro 429 → `"rate"`; sucesso chama `signInWithOtp` com `emailRedirectTo` = `${site}/auth/confirmar?next=...`.
- [ ] `?erro=link` e `?erro=github` mostram aviso no card.

### Task 5: Boas-vindas (escolher @usuário)

**Files:** Create `src/app/(auth)/boas-vindas/page.tsx`, `actions.ts` (`checkUsername(raw): Promise<"available" | "taken" | ValidationReason>`, `completeOnboarding(prev, formData): Promise<{ errors?: { username?: string; displayName?: string; tags?: string; avatar?: string } }>`), `src/components/onboarding/onboarding-form.tsx` (cliente: checagem com espera de 400 ms, contador de tags, troca de foto com prévia).

- Foto: envia para `avatars/<uid>/avatar-<timestamp>.<ext>` e grava a URL pública em `profiles.avatar_url`. Sem troca, mantém a do GitHub.
- Tags: lista de `tags` (as iniciais do banco), mínimo 3, grava em `tag_follows`.
- [ ] Testes de `completeOnboarding`: @ inválido não chama o banco; `23505` → "já está em uso"; menos de 3 tags → erro; sucesso redireciona para `/`.

### Task 6: Layout do app (desktop e celular)

**Files:** Create `src/app/(app)/layout.tsx` (aplica `routeFor("app")`), mover `src/app/page.tsx` para `src/app/(app)/page.tsx`, criar `(app)/projetos`, `(app)/estudos`, `(app)/notificacoes` (exigem login), `(app)/u/[username]/page.tsx` (perfil básico; `notFound()` se não existir), rewrite `/@:username` → `/u/:username` em `next.config.ts`; componentes `src/components/shell/top-nav.tsx`, `nav-links.tsx`, `user-menu.tsx`, `mobile-top-bar.tsx`, `mobile-tab-bar.tsx`, `coming-soon.tsx`.

- Desktop (≥ md): logo, Início/Projetos/Estudos (ativo com fundo `bg-hover` e ícone ciano), busca (desabilitada, "Ctrl K"), sino, "Publicar", avatar com menu (Meu perfil, Sair). Visitante: "Entrar".
- Celular (< md): barra de cima com logo, busca e +; abas embaixo Início, Projetos, Estudos, Notificações, Perfil.
- [ ] Teste de unidade de `NavLinks`: item da rota atual tem `aria-current="page"`.

### Task 7: E2E e CI

**Files:** `e2e/auth.spec.ts`, `e2e/helpers/mailpit.ts` (`latestLinkFor(email): Promise<string>`), atualizar `e2e/home.spec.ts`; `.github/workflows/ci.yml` com `supabase/setup-cli`, `supabase start` (só os serviços usados), `.env.local` a partir do `supabase status -o env`, build e E2E.

- [ ] E2E: link mágico → `/boas-vindas` → escolhe @, 3 tags → `/` com o avatar e `@usuário` no menu → Sair → entrar de novo vai direto para `/`; link usado de novo → `/entrar?erro=link`; visitante em `/boas-vindas` → `/entrar`; "Continuar com GitHub" navega para `github.com/login/oauth/authorize` com o `client_id`; celular (390 px) mostra as 5 abas.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` passam.
