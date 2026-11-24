# Importar projeto do GitHub — plano

> Execução: nativa (a thread implementa tudo e pede uma revisão do branch no final, como nos outros subprojetos).

**Goal:** botão "Importar do GitHub" em /projetos/novo que preenche o formulário a partir de um repositório público.
**Architecture:** lógica pura em `src/lib/projects/github.ts` (fetch injetável); painel cliente `github-import.tsx` dentro do `PublishForm`; a página passa o usuário do GitHub da pessoa.
**Tech Stack:** Next 16, React 19, next-intl, Vitest + Testing Library.
**Spec:** docs/superpowers/specs/2026-11-24-devsync-importar-github-design.md

## Global Constraints
- Só `https://api.github.com`, sem token. Forks fora. Até 5 assuntos (TAGS_MAX), descrição até DESCRIPTION_MAX (20 000).
- Textos em PT-BR em `messages/pt-BR.json`, namespace `GithubImport`.

## Review Focus
- Usuário sem repositórios públicos: mensagem "nenhum repositório", não lista vazia muda.
- Limite do GitHub (403/429 com `x-ratelimit-remaining: 0`): erro `rate_limit` com hora de reset.
- README ausente (404): usa a descrição do repo.
- README maior que 20 000: usa a descrição do repo.
- Homepage sem https ou vazia: não mexe no site nem na demo.

### Task 1: `src/lib/projects/github.ts`
Produz:
- `type GithubRepo = { name; fullName; description: string|null; htmlUrl; homepage: string|null; language: string|null; topics: string[]; fork: boolean; pushedAt: string; defaultBranch: string }`
- `class GithubError extends Error { code: "not_found"|"rate_limit"|"network"; resetAt?: Date }`
- `listRepos(user, fetchFn?) => Promise<GithubRepo[]>` (GET /users/:u/repos?per_page=100&sort=pushed, sem forks)
- `repoDetails(repo, fetchFn?) => Promise<{ readme: string|null; languages: string[] }>` (readme raw, 404 → null; languages ordenadas por bytes)
- `mapTags(names: string[], available: string[]) => string[]` (apelidos, só existentes, sem repetir, até 5)
- `absolutizeReadme(md, repo) => string` (links relativos → github.com/<repo>/blob/<branch>/..., âncoras e absolutos intocados)
- `importDraft(repo, details, available) => { title; description; tags; repoUrl; siteUrl; demoLink: string|null }`
Testes: `github.test.ts` cobrindo cada um + Review Focus.

### Task 2: painel e formulário
- `PublishServices.github?: { user: string|null; listRepos; repoDetails }`.
- `GithubImport` (`src/components/projects/github-import.tsx`): botão abre painel; campo do usuário; lista com busca; "Usar" chama `onImport(draft)`; estados carregando/erro/vazio.
- `PublishForm` aplica o draft (demoLink → modo link).
- Testes em `publish-form.test.tsx`.

### Task 3: ligação e CSP
- Página lê o usuário (`getGithubLogin()`: profiles.links.github, senão user_metadata.user_name do login GitHub) e passa a `ConnectedPublishForm`.
- `security-headers.ts`: `https://api.github.com` em connect-src (+ teste).
- Verificação: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
