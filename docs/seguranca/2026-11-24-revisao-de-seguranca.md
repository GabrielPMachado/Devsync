# Revisão de segurança do lançamento (2026-11-24)

Feita no subprojeto 8, sobre a `main` com os subprojetos 0 a 7. Situação: **sem pendências no código**. As pendências abaixo dependem de configuração no painel (listadas em `docs/lancamento.md`).

## Conferido

| Área | O que foi conferido | Resultado |
|---|---|---|
| Banco: RLS | Toda tabela de `public` tem RLS e política (teste `08_schema_lint`); usuário suspenso bloqueado na RLS (testes 01 a 06) | ok |
| Banco: funções na API | Security Advisor apontava 27 funções `security definer` executáveis por `anon`/`authenticated` | **corrigido**: migration `20261124300000_function_privileges.sql` + teste `11_function_privileges` |
| Banco: `demo_uploads` sem política | Aviso INFO do advisor | intencional: tabela só da `service_role` |
| Chaves | `service_role` só no Worker de demos e no E2E do CI; o site só tem a chave publishable | ok |
| Login | Retorno do GitHub e do link mágico usam `safeNext` (sem redirecionamento aberto) | ok |
| Markdown | Sem HTML cru (`skipHtml`/sem `rehype-raw`), links externos com `nofollow ugc noopener noreferrer`, `javascript:` filtrado | ok |
| `/admin` | Página confere `isAdmin` no servidor; RPCs `admin_*` conferem o papel no banco | ok |
| Cabeçalhos do site | CSP (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, conexões só Supabase e demos), HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP | **adicionado** (`src/lib/security-headers.ts`, E2E `launch.spec.ts`) |
| Demos | Domínio separado, um subdomínio por demo, HTML só em iframe, CSP `frame-ancestors`, zip com caminho malicioso e symlink recusados (testes do Worker) | ok |
| Demos: abuso da API | `/complete`, `/embed-check` e `/verify` sem limite | **corrigido**: 30 chamadas/min por IP em produção |
| Dependências | `npm audit --omit=dev` no site e no Worker | 0 vulnerabilidades |
| Service worker | Não guarda páginas com dados de conta; push só abre URL relativa do próprio site | ok |

## Riscos aceitos

- **CSP com `'unsafe-inline'` em `script-src`.** Nonce obrigaria a renderizar tudo por pedido. A defesa principal contra XSS continua sendo o React (escapa tudo) e o Markdown sem HTML cru.
- **`frame-src https:`.** Demos por link podem estar em qualquer site https. O iframe usa `sandbox` sem `allow-top-navigation`.
- **`allow-popups` no iframe da demo** (já registrado no README do Worker).

## Pendências de configuração (painel, não código)

1. Rodar `aplicar-seguranca.sql` no Supabase (e os de moderação e social, se ainda não rodou).
2. **E-mail de login:** o SMTP padrão do Supabase só envia para membros da equipe do projeto e poucas mensagens por hora. Antes de abrir para o público, configurar um SMTP próprio (ex.: Resend, plano grátis) em Authentication > Emails > SMTP Settings.
3. Redirect URLs do Supabase Auth com `https://devsync-br.vercel.app/**`.
