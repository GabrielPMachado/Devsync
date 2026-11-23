# Setup do repositório da Devsync: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (execução nativa, revisão única no final, como o Gabriel escolheu para o banco). Steps usam checkbox (`- [ ]`).

**Goal:** deixar o repositório pronto para o subprojeto 2 (base do site): app Next.js rodando, tema Tailwind com os tokens do Figma, textos via next-intl em pt-BR, clientes Supabase prontos e CI verde.

**Architecture:** Next.js (App Router, `src/`) na raiz do repositório, ao lado de `supabase/` (PR 1). Tokens do Figma vivem em `src/styles/tokens.css` como variáveis CSS e são expostos ao Tailwind v4 via `@theme`. next-intl sem prefixo de idioma na URL (locale fixo `pt-BR` resolvido em `src/i18n/request.ts`). Supabase via `@supabase/ssr` com um cliente de navegador e um de servidor, e um `middleware.ts` que renova a sessão.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, next-intl 4, @supabase/ssr, zod (validação de env), Vitest + Testing Library, Playwright, ESLint, GitHub Actions, npm.

**Spec:** `docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md` (5.7, 5.9, 7) e `docs/superpowers/plans/2026-11-23-devsync-fase-1-roteiro.md` (subprojeto 2).

## Global Constraints

- Custo US$ 0: só planos grátis. CI no GitHub Actions sem serviços pagos.
- Interface em pt-BR, todos os textos em `next-intl`. URLs sem prefixo de idioma. `<html lang="pt-BR">`.
- Visual: fundo escuro, gradiente `#2563EB` → `#22D3EE`. Tokens exatamente como no plugin do Design System (coleções Primitivos, Cor, Espaço e raio; fontes Plus Jakarta Sans, Inter, JetBrains Mono).
- Nada é aplicado no Supabase remoto. Nenhuma chave real no repositório: só `.env.example`.
- Variáveis públicas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `MODERATION_AI_ENABLED=false` e `DEMOS_HOST` documentadas no `.env.example`.
- Não mexer em `supabase/` (pertence ao PR 1).

## Review Focus

1. Site sem variáveis do Supabase (CI, clone novo): build e página inicial precisam funcionar; o middleware não pode quebrar a página. Teste: `middleware` retorna `next()` sem env (Task 4).
2. Env com URL inválida: erro claro em pt-BR, não um erro genérico do supabase-js. Teste em `env.test.ts` (Task 4).
3. Chave de tradução faltando: o build/test precisa acusar. Teste que compara as chaves usadas na página com `messages/pt-BR.json` (Task 3).
4. Token do Figma divergindo do CSS: teste que confere os hex de `tokens.css` contra a tabela do Figma (Task 2).
5. Gradiente/contraste: texto primário sobre `bg/base` usado no layout padrão (Task 2, checado na página inicial do E2E).

---

### Task 1: Esqueleto Next.js + ferramentas de qualidade

**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`, `.nvmrc`, `.env.example`

- [ ] Gerar com `create-next-app` (TS, App Router, `src/`, Tailwind, ESLint, alias `@/*`).
- [ ] Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`).
- [ ] Verificar: `npm run lint && npm run typecheck && npm run build` passam.
- [ ] Commit `chore: esqueleto Next.js`.

### Task 2: Tema com tokens do Figma

**Files:** `src/styles/tokens.css`, `src/app/globals.css`, `src/lib/design-tokens.ts`, `src/lib/design-tokens.test.ts`

**Interfaces — Produces:** classes Tailwind `bg-bg-base`, `bg-bg-surface`, `text-text-primary`, `text-text-muted`, `border-border-default`, `bg-brand-primary`, `text-brand-accent`, `bg-brand-gradient`, `rounded-{sm,md,lg,xl,2xl}`, `font-display`, `font-sans`, `font-mono`; `PRIMITIVES` e `SEMANTIC` exportados de `design-tokens.ts`.

- [ ] Teste: cada par de `SEMANTIC` aponta para um primitivo existente; `PRIMITIVES['blue/600'] === '#2563EB'`, `PRIMITIVES['cyan/400'] === '#22D3EE'`; todo `--color-*` em `tokens.css` tem o hex igual ao de `PRIMITIVES` resolvido (lê o arquivo).
- [ ] Ver falhar, implementar, ver passar.
- [ ] Fontes via `next/font/google` (Plus Jakarta Sans, Inter, JetBrains Mono) como variáveis CSS.
- [ ] Commit `feat: tema com tokens do Figma`.

### Task 3: next-intl em pt-BR sem prefixo

**Files:** `src/i18n/config.ts` (`locales = ['pt-BR'] as const`, `defaultLocale = 'pt-BR'`), `src/i18n/request.ts`, `messages/pt-BR.json`, `next.config.ts`, `src/app/page.tsx`, `src/i18n/messages.test.ts`, `src/app/page.test.tsx`

- [ ] Teste: página inicial renderiza "Connect. Share. Develop." e o texto pt-BR do JSON; nenhuma chave de `pt-BR.json` vazia.
- [ ] Implementar com `getRequestConfig` e `NextIntlClientProvider` no layout; `lang` do `<html>` vem do locale.
- [ ] Commit `feat: next-intl em pt-BR`.

### Task 4: Clientes Supabase e middleware de sessão

**Files:** `src/lib/env.ts` (`getSupabaseEnv(): { url: string; anonKey: string } | null`, lança `Error` em pt-BR para URL inválida), `src/lib/supabase/client.ts` (`createClient()`), `src/lib/supabase/server.ts` (`createClient(): Promise<SupabaseClient>`), `src/lib/supabase/middleware.ts` (`updateSession(req): Promise<NextResponse>`), `src/middleware.ts`, testes `*.test.ts`

- [ ] Testes: env ausente → `null`; URL inválida → erro com "NEXT_PUBLIC_SUPABASE_URL"; `updateSession` sem env devolve resposta 200 sem chamar o Supabase.
- [ ] Implementar com `@supabase/ssr` (`createBrowserClient`, `createServerClient` + `cookies()`).
- [ ] Commit `feat: clientes Supabase`.

### Task 5: E2E de fumaça e CI

**Files:** `e2e/home.spec.ts`, `.github/workflows/ci.yml`, `README.md`

- [ ] E2E: `/` responde 200, `html[lang="pt-BR"]`, título visível, fundo `rgb(7, 11, 20)`.
- [ ] CI em `pull_request` e `push`: Node da `.nvmrc`, `npm ci`, lint, typecheck, test, build, Playwright (chromium) com cache.
- [ ] README em pt-BR: como rodar, scripts, variáveis.
- [ ] Verificação completa e PR.
