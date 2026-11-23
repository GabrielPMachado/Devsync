# Devsync

**Connect. Share. Develop.** A rede social para desenvolvedores: projetos com demo funcionando, estudos em perguntas e respostas e uma comunidade sem grosseria.

Arquitetura: [`docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md`](docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md) · Roteiro da fase 1: [`docs/superpowers/plans/2026-11-23-devsync-fase-1-roteiro.md`](docs/superpowers/plans/2026-11-23-devsync-fase-1-roteiro.md)

## Stack

- Next.js 16 (App Router, `src/`) e React 19, em TypeScript
- Tailwind CSS 4 com os tokens do Design System do Figma (`src/styles/tokens.css`)
- next-intl: todos os textos em `messages/pt-BR.json`, sem prefixo de idioma na URL
- Supabase (`@supabase/ssr`): banco e migrações em `supabase/`
- Vitest + Testing Library (unidade) e Playwright (ponta a ponta)

## Como rodar

Precisa de Node 22 (veja `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # opcional: sem Supabase o site abre, só sem login
npm run dev                  # http://localhost:3000
```

### Com login (Supabase local)

Precisa do Docker e do [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
supabase start               # banco, Auth, Storage e Mailpit (e-mails) em Docker
supabase status -o env       # copie API_URL e ANON_KEY para o .env.local:
                             # NEXT_PUBLIC_SUPABASE_URL=<API_URL>
                             # NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
npm run dev
```

Os e-mails de login chegam no Mailpit: http://127.0.0.1:54324. Para testar o GitHub
localmente, crie um app OAuth de teste (callback `http://127.0.0.1:54321/auth/v1/callback`)
e exporte `SUPABASE_AUTH_GITHUB_CLIENT_ID` e `SUPABASE_AUTH_GITHUB_SECRET` antes do `supabase start`.

Os testes E2E de login precisam do Supabase local rodando e do `.env.local` preenchido antes do `npm run build`.

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build de produção e servidor |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota e roda o `tsc` |
| `npm test` | Testes de unidade (Vitest) |
| `npm run test:e2e` | Testes ponta a ponta (Playwright; rode `npm run build` antes e `npx playwright install chromium` uma vez) |

## Organização

```
src/
  app/              rotas (App Router)
  components/       componentes de interface
  i18n/             configuração do next-intl (idioma fixo pt-BR por enquanto)
  lib/
    design-tokens.ts  tokens do Figma em TypeScript (fonte da verdade dos testes)
    env.ts            leitura e validação das variáveis de ambiente
    supabase/         clientes do navegador e do servidor, renovação de sessão
  styles/tokens.css tema do Tailwind gerado a partir dos tokens
  proxy.ts          roda antes de cada página (renova a sessão do Supabase)
  app/(auth)/       /entrar e /boas-vindas (sem a barra de navegação)
  app/(app)/        páginas com a barra de navegação e as abas do celular
  app/auth/         retorno do GitHub, link mágico e sair
  lib/auth/         regras do @usuário, destino seguro e quem vai para onde
messages/pt-BR.json textos da interface
e2e/                testes do Playwright
supabase/           migrações e testes do banco
workers/demos/      serviço de demos (Cloudflare Worker, pacote próprio; veja o README dele)
```

## Regras do tema

- Use os tokens semânticos (`bg-bg-surface`, `text-text-muted`, `border-border-default`, `bg-brand-primary`...). As cores padrão do Tailwind foram removidas de propósito.
- Espaçamento em grade de 4 px (`p-4` = 16 px). Raios: `rounded-md` (8 px) em controles, `rounded-lg`/`rounded-xl` em cards, `rounded-2xl` em camadas grandes.
- Fontes: `font-display` (Plus Jakarta Sans) em títulos, `font-sans` (Inter) no texto, `font-mono` (JetBrains Mono) em código.
- Gradiente da marca só em destaques: `bg-brand-gradient` e `text-brand-gradient`.
- Mudou um token no Figma? Atualize `src/lib/design-tokens.ts` e `src/styles/tokens.css`; o teste `design-tokens.test.ts` confere os dois.
