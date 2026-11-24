# Banco de dados da Devsync (Supabase)

Schema do Postgres da Devsync: tabelas, permissões (RLS), gatilhos, busca, feed
e a ordem das respostas. Tudo em migrations SQL versionadas em `migrations/`.

Spec: `docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md` (seção 5.8).
Plano: `docs/superpowers/plans/2026-11-23-devsync-banco-supabase.md`.

## Rodar os testes

Sem Docker e sem projeto Supabase, num Postgres local temporário:

```bash
scripts/test-db.sh                                   # todos
scripts/test-db.sh supabase/tests/database/03_questions.test.sql   # um arquivo
```

Precisa de PostgreSQL 15+ com `pgtap` e `unaccent`, e do `pg_prove`
(Debian/Ubuntu: `postgresql-16-pgtap` e `libtap-parser-sourcehandler-pgtap-perl`).
O arquivo `tests/local/supabase_shim.psql` imita o que o Supabase já traz
(`auth.users`, `auth.uid()`, os papéis `anon`, `authenticated` e `service_role`).

Com o Supabase CLI e Docker: `supabase start`, `supabase db reset` e `supabase test db`.

## Aplicar num projeto Supabase

Ainda não existe projeto remoto. Quando existir (plano gratuito):

```bash
supabase link --project-ref <ref>
supabase db push
```

## Regras gerais

- Toda tabela tem RLS ligada. Visitantes só leem conteúdo público.
- O usuário só escreve as colunas liberadas por `GRANT` de coluna. Contadores
  (`likes_count`, `score`, `answers_count`...), `role`, `suspended_at`,
  `hidden_at`, `demos.status` e os slugs são escritos por gatilhos, pelo
  serviço de demos (`service_role`) ou pelas funções de admin.
- Usuário suspenso não cria nem edita nada, mesmo chamando a API direto.
- Conteúdo oculto pela moderação some para todos, menos o autor e admins.
- Slugs de projeto e pergunta são gerados do título e nunca mudam.
- Toda edição de título ou corpo guarda a versão anterior em `revisions`.

## Funções para o site

| Função | Uso |
|---|---|
| `answers_ordered(question_id)` | Respostas na ordem da seção 5.4. Mostre o selo "mais votada recentemente" quando a primeira não for a aceita e houver aceita. |
| `search_content(q, tag_slugs, kinds)` | Busca em perguntas, projetos e perfis. `kinds` aceita `question`, `project`, `profile`. |
| `home_feed(before, page_size)` | Feed de início. Para a próxima página, passe o `created_at` do último item. |
| `trending_projects(page_size)` | Explorar: projetos em alta (curtidas dos últimos 7 dias com peso por tempo). Devolve `id` e `score`. |
| `suggested_profiles(page_size)` | "Quem seguir": perfis não seguidos, com tecnologias em comum primeiro. Visitante recebe os mais seguidos. |
| `admin_set_hidden`, `admin_suspend_profile`, `admin_set_demo_status`, `admin_resolve_report`, `admin_mark_duplicate` | Página `/admin`. Só admins. |

## Erros próprios

| SQLSTATE | Quando |
|---|---|
| `DS001` | Limite de 5 envios de demo por dia |
| `DS002` | Envio de demo sem e-mail confirmado |
| `DS003` | Mais de 5 tags numa pergunta ou projeto |
| `42501` | Sem permissão (RLS, coluna protegida, usuário suspenso) |

## O que fica para outros subprojetos

- O mínimo de 1 tag por pergunta é conferido pelo site (pergunta e tags chegam
  em chamadas separadas).
- Buckets e políticas do Supabase Storage (avatares e imagens): subprojeto 2.
- Primeiro admin: depois do primeiro login, rode no SQL Editor
  `update profiles set role = 'admin' where username = '<seu @>';`.
