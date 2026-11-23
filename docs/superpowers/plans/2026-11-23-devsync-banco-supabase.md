# Banco Supabase da Devsync (subprojeto 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o schema completo do Postgres da Devsync (tabelas, enums, RLS, gatilhos, busca, feed e ordem das respostas) como migrations versionadas em `supabase/`, com testes pgTAP passando.

**Architecture:** Migrations SQL puras em `supabase/migrations/`, uma por domínio. Permissões em três camadas: RLS por linha, `GRANT` por coluna (o usuário nunca escreve contadores, `role`, `hidden_at` etc.) e funções `security definer` com `set search_path = ''` para gatilhos e ações de admin. Os testes rodam em pgTAP tanto com `supabase test db` quanto num Postgres 16 local sem Docker, graças a um "shim" que imita o que o Supabase já traz (`auth.users`, `auth.uid()`, papéis `anon`/`authenticated`/`service_role`, publicação `supabase_realtime`).

**Tech Stack:** PostgreSQL 15+ (Supabase), pgTAP, `unaccent`, busca de texto com configuração `portuguese`.

**Spec:** `docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md` (seções 5.4, 5.5, 5.6, 5.8) e o roteiro `docs/2026-11-23-devsync-fase-1-roteiro.md` (contratos entre subprojetos).

## Global Constraints

- Custo US$ 0: nada é aplicado em projeto Supabase remoto sem o Gabriel pedir. Só arquivos no repositório.
- O repositório ainda não tem Next.js: só a pasta `supabase/` (mais o plano e o script de teste).
- Nomes de tabelas e colunas exatamente como na seção 5.8 da spec (inglês). Colunas extras são permitidas; renomear não.
- Enum `demo_kind`: `web_link | web_upload | sandbox | mobile`. Enum `demo_status`: `pending | live | blocked | unavailable`.
- Funções fixadas pelo roteiro: `answers_ordered(question_id uuid) returns setof answers`, `search_content(q text, tag_slugs text[], kinds text[]) returns table(kind text, id uuid, title text, rank real)`, `home_feed(before timestamptz, page_size int) returns table(kind text, id uuid, created_at timestamptz)`.
- Todo conteúdo tem `lang text not null default 'pt-BR'`.
- Nenhuma tabela pública sem RLS ligada e sem política.
- Usuário suspenso (`profiles.suspended_at` preenchido) não cria nem edita nada, mesmo chamando a API do Supabase direto.
- Funções `security definer` sempre com `set search_path = ''` e nomes qualificados (`public.x`).
- Comentários do SQL e README em pt-BR.

## Decisões deste plano (ficam a critério de quem constrói, seção 10 da spec)

1. **Chaves:** `uuid` (`gen_random_uuid()`) em todas as tabelas, inclusive `tags`, para o contrato `search_content` e as colunas polimórficas (`target_id`) usarem um tipo só.
2. **Slug:** `projects.slug` e `questions.slug` são únicos no banco, gerados por gatilho a partir do título (`unaccent`, minúsculas, hífens, máx. 60 caracteres) mais sufixo aleatório de 6 caracteres. Não mudam depois de criados, para nenhuma URL indexada quebrar.
3. **@usuário:** `profiles.username` começa nulo (escolhido no primeiro acesso, seção 5.7). Formato `^[a-z0-9_]{3,30}$`, único sem diferenciar maiúsculas, com lista de nomes reservados (`admin`, `api`, `perguntas`, `projetos`, `demo`, `u`, `tags`, `busca`, `explorar`, `configuracoes`, `login`, `devsync`, `suporte`, `en`).
4. **Perfil automático:** gatilho em `auth.users` cria `profiles` com `display_name` e `avatar_url` vindos do GitHub (`raw_user_meta_data`).
5. **Tags:** qualquer usuário ativo cria tag nova (formato `^[a-z0-9][a-z0-9+#.-]{0,29}$`, aceita `c#`, `c++`, `node.js`); só admin edita ou apaga. Uma lista inicial de tags entra numa migration, com `iniciante` incluída. Máximo de 5 tags por pergunta e por projeto, garantido por gatilho. O mínimo de 1 tag por pergunta fica na aplicação (subprojeto 5), porque o supabase-js insere pergunta e tags em chamadas separadas.
6. **Comentários em 2 níveis:** comentário raiz e respostas. Responder a uma resposta pendura o novo comentário na raiz (como no YouTube), em vez de dar erro.
7. **Ordem das respostas:** a regra 3 (3+ marcações descem) vale também para a resposta aceita. Uma aceita marcada como "não funciona mais" por 3 pessoas não fica no topo. O selo "mais votada recentemente" não é coluna (o contrato devolve `setof answers`): o site mostra o selo quando a primeira resposta não é a aceita e existe uma aceita.
8. **Moderação:** `hidden_at` em `projects`, `questions`, `answers` e `comments`. Conteúdo oculto some para todos, menos o autor e admins. Ações de admin são funções RPC que conferem `is_admin()`.
9. **Notificações:** uma linha por evento, criada por gatilho (o agrupamento "Ana e mais 4" é feito na leitura). Desfazer curtida, voto ou follow apaga a notificação ainda não lida. Ninguém é notificado das próprias ações. A tabela entra na publicação `supabase_realtime`.
10. **Limite de demos:** criar demo `web_upload` exige e-mail confirmado em `auth.users` e no máximo 5 por dia por pessoa. O Worker de demos (subprojeto 3) usa a `service_role` e não passa por esse gatilho de RLS, mas passa pelo gatilho de limite.
11. **Fora deste subprojeto:** buckets e políticas do Supabase Storage (avatares, imagens) ficam com o subprojeto 2, junto do upload no site.

## Review Focus

1. Usuário suspenso tentando inserir pergunta, resposta, comentário, voto ou curtida direto pela API: tem que receber erro de RLS. Teste no Task 2, 5, 6 e 7 (`suspended user cannot insert`).
2. Usuário tentando escrever coluna protegida (`profiles.role`, `answers.score`, `projects.likes_count`, `questions.hidden_at`, `demos.status`): tem que dar `permission denied`. Teste em cada task que cria a tabela.
3. Pessoa A tentando aceitar resposta na pergunta de B, ou aceitar uma resposta de outra pergunta: erro. Teste no Task 5.
4. Voto repetido, troca de voto (+1 para -1) e remoção: a pontuação tem que bater sempre. Teste no Task 5.
5. Apagar uma pergunta: respostas, comentários, revisões e notificações ligadas somem sem deixar linha órfã. Teste no Task 6.

---

## File Structure

```
supabase/
  config.toml                         projeto local do Supabase CLI (mínimo)
  migrations/
    20261123000100_base.sql           extensões, enums, funções auxiliares
    20261123000200_profiles.sql       profiles, tags, profile_tags, tag_follows, follows
    20261123000300_projects.sql       demos, projects, project_tags, likes
    20261123000400_questions.sql      questions, question_tags, answers, answer_votes,
                                      outdated_flags, detail_requests
    20261123000500_comments.sql       comments, limpeza de alvos apagados
    20261123000600_notifications.sql  notifications, reports, gatilhos de notificação, RPCs de admin
    20261123000700_read_functions.sql answers_ordered, search_content, home_feed
    20261123000800_seed_tags.sql      tags iniciais
  tests/
    database/                         testes pgTAP (rodados por `supabase test db`)
      00_setup.test.sql ... 07_read_functions.test.sql
    local/
      supabase_shim.sql               imita auth/papéis do Supabase num Postgres comum
  README.md                           como rodar e regras do schema
scripts/
  test-db.sh                          sobe Postgres temporário, aplica shim + migrations, roda pg_prove
```

**Helpers de teste (no shim e também em `00_setup`):** `tests.create_user(email text, username text) returns uuid` cria linha em `auth.users` (e o perfil via gatilho) com e-mail confirmado; `tests.login_as(user_id uuid)` faz `set local role authenticated` e grava `request.jwt.claims`; `tests.logout()` volta para `postgres`. Cada arquivo de teste roda em `begin; ... rollback;`.

---

### Task 1: Base, shim e script de teste

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20261123000100_base.sql`, `supabase/tests/local/supabase_shim.sql`, `supabase/tests/database/00_setup.test.sql`, `scripts/test-db.sh`

**Interfaces:**
- Produces: enums `user_role(user, admin)`, `demo_kind`, `demo_status`, `comment_target(project, question, answer)`, `revision_target(project, question, answer, comment)`, `report_target(project, question, answer, comment, demo, profile)`, `report_status(open, dismissed, actioned)`, `notification_type(follow, comment, reply, answer, accepted, like, vote, detail_request)`, `notification_target(profile, project, question, answer, comment)`; tabela `revisions(id, target_type revision_target, target_id uuid, editor_id uuid, title text, body_md text, created_at)` (sem política de escrita: só gatilhos gravam); funções `public.set_updated_at() returns trigger`, `public.slugify(text) returns text`, `public.is_admin() returns boolean`, `public.is_active_user() returns boolean` (as duas últimas são `security definer`, `stable`, olham `auth.uid()`). `is_admin`/`is_active_user` só são criadas no Task 2, depois de `profiles`.

- [ ] **Step 1:** Teste `00_setup`: `has_type` para cada enum, `enum_has_labels('public','demo_status', array['pending','live','blocked','unavailable'])`, `is(public.slugify('Olá, Mundo! Ação em C++'), 'ola-mundo-acao-em-c')`.
- [ ] **Step 2:** `scripts/test-db.sh`: `initdb` em pasta temporária, `pg_ctl start` numa porta livre, aplica o shim, todas as migrations em ordem e `create extension pgtap`, roda `pg_prove` em `supabase/tests/database/*.test.sql`, para o servidor. Rodar e ver falhar (enums não existem).
- [ ] **Step 3:** Escrever shim (`auth` schema, `auth.users(id, email, email_confirmed_at, raw_user_meta_data, created_at)`, `auth.uid()`/`auth.jwt()` lendo `request.jwt.claims`, papéis `anon`, `authenticated`, `service_role bypassrls`, `grant usage on schema public`, default privileges iguais aos do Supabase, publicação `supabase_realtime` vazia, schema `tests` com os helpers) e a migration base (`create extension if not exists unaccent with schema extensions`, enums, `set_updated_at`, `slugify`).
- [ ] **Step 4:** `scripts/test-db.sh` passa.
- [ ] **Step 5:** Commit `feat(db): base do schema e ambiente de teste`.

### Task 2: Perfis, tags e seguir

**Files:** Create `supabase/migrations/20261123000200_profiles.sql`, `supabase/tests/database/01_profiles.test.sql`

**Interfaces:**
- Produces: tabelas `profiles(id uuid pk → auth.users on delete cascade, username text null, display_name text, avatar_url text, bio text ≤ 500, links jsonb default '{}', locale text default 'pt-BR', role user_role default 'user', suspended_at timestamptz, followers_count int, following_count int, search tsvector generated, created_at, updated_at)`, `tags(id uuid, slug text unique, name text, description text, created_by uuid, created_at)`, `profile_tags(profile_id, tag_id)`, `tag_follows(profile_id, tag_id)`, `follows(follower_id, followee_id, created_at, check follower_id <> followee_id)`; `is_admin()`, `is_active_user()`; gatilho `handle_new_user` em `auth.users`.
- Colunas que `authenticated` pode atualizar em `profiles`: `username, display_name, avatar_url, bio, links, locale`.

- [ ] **Step 1: testes** `new auth user gets profile` (display_name vem de `raw_user_meta_data->>'name'`); `username format enforced` (`'Ab'`, `'admin'` falham; `'ana_dev'` passa); `username unique case-insensitive`; `user cannot update role` (`throws_ok ... '42501'`); `user cannot update other profile` (0 linhas afetadas); `follow updates counters` e `unfollow updates counters`; `cannot follow self`; `suspended user cannot follow`; `anon can read profiles`; `tag slug format` (`'C#'` falha, `'c#'` passa); `user cannot delete tag`.
- [ ] **Step 2:** rodar, ver falhar.
- [ ] **Step 3:** implementar tabelas, índices (`unique (lower(username))`, `follows(followee_id)`), RLS, grants por coluna, gatilhos de contador (`security definer`) e de perfil novo.
- [ ] **Step 4:** testes passam.
- [ ] **Step 5:** Commit `feat(db): perfis, tags e seguir`.

### Task 3: Demos, projetos e curtidas

**Files:** Create `supabase/migrations/20261123000300_projects.sql`, `supabase/tests/database/02_projects.test.sql`

**Interfaces:**
- Produces: `demos(id, owner_id, kind demo_kind, url, storage_prefix, version int default 1, status demo_status default 'pending', embeddable boolean, screenshot_url, checked_at, created_at, updated_at)`; `projects(id, author_id, title 3..120, slug unique, description_md ≤ 20000, repo_url, site_url, cover_url, demo_id → demos on delete set null, lang, likes_count, comments_count, hidden_at, search tsvector, created_at, updated_at)`; `project_tags`; `likes(profile_id, project_id, created_at)`.
- `authenticated` insere em `demos` só `(kind, url)` (owner vem de `auth.uid()` por default) e atualiza só `url`; trocar `url` volta `status` para `pending`. `status`, `embeddable`, `storage_prefix`, `version`, `checked_at` só pela `service_role` ou `admin_set_demo_status`.
- URLs (`url`, `repo_url`, `site_url`) precisam começar com `https://`.

- [ ] **Step 1: testes** `project slug generated and immutable`; `demo url must be https`; `user cannot set demo status`; `changing demo url resets status`; `sixth web_upload demo in 24h fails`; `unconfirmed email cannot create web_upload demo`; `pending demo invisible to others, live demo visible`; `project cannot use someone else's demo`; `like updates likes_count, unlike reverts`; `user cannot write likes_count`; `sixth project tag fails`; `hidden project invisible to others but visible to author`; `suspended user cannot insert project`.
- [ ] **Step 2:** ver falhar. **Step 3:** implementar. **Step 4:** passar.
- [ ] **Step 5:** Commit `feat(db): demos, projetos e curtidas`.

### Task 4: Perguntas e respostas

**Files:** Create `supabase/migrations/20261123000400_questions.sql`, `supabase/tests/database/03_questions.test.sql`

**Interfaces:**
- Produces: `questions(id, author_id, title 10..150, slug unique, body_md ≤ 30000, project_id → projects on delete set null, accepted_answer_id → answers on delete set null, duplicate_of_id → questions, lang, answers_count, comments_count, detail_requests_count, hidden_at, search tsvector, created_at, updated_at)`; `question_tags`; `answers(id, question_id cascade, author_id, body_md, demo_id, tech_version ≤ 40, score int, outdated_flags int, comments_count, hidden_at, created_at, updated_at)`; `answer_votes(profile_id, answer_id, value smallint in (-1, 1), created_at)`; `outdated_flags(profile_id, answer_id, created_at)`; `detail_requests(profile_id, question_id, created_at)`.
- Colunas editáveis: `questions(title, body_md, project_id, accepted_answer_id)`, `answers(body_md, demo_id, tech_version)`, `answer_votes(value)`.

- [ ] **Step 1: testes** `vote +1 then change to -1 then delete keeps score right` (1, -1, 0); `cannot vote own answer`; `only question author accepts`; `cannot accept answer from other question`; `answer insert bumps answers_count`; `outdated flag increments, editing answer body resets flags to 0 and deletes rows`; `cannot flag own answer`; `detail request on own question fails`; `editing question body creates revision with old body`; `cannot answer hidden question`; `suspended user cannot answer`; `user cannot write score`.
- [ ] **Step 2–4:** falhar, implementar (gatilhos de contador, aceitação, reset de marcações), passar.
- [ ] **Step 5:** Commit `feat(db): perguntas, respostas e votos`.

O gatilho de revisão (`public.save_revision()`, grava título e corpo antigos quando mudam) é criado aqui e ligado a `questions` e `answers`; ligue também em `projects` (Task 3) neste mesmo task.

### Task 5: Comentários e revisões

**Files:** Create `supabase/migrations/20261123000500_comments.sql`, `supabase/tests/database/04_comments.test.sql`

**Interfaces:**
- Consumes: `revisions` (Task 1) e `public.save_revision()` (Task 4).
- Produces: `comments(id, author_id, target_type comment_target, target_id, parent_id → comments cascade, depth smallint 0..1, body_md 1..5000, hidden_at, created_at, updated_at)`; função `public.content_is_visible(target_type text, target_id uuid) returns boolean` (`security definer`); gatilhos `after delete` em `projects`, `questions`, `answers` e `comments` que apagam comentários, revisões e notificações do alvo.

- [ ] **Step 1: testes** `comment on missing target fails`; `reply to reply attaches to root` (`depth = 1`, `parent_id = raiz`); `comment bumps comments_count on target`; `cannot comment on hidden project`; `deleting question removes its comments and revisions`; `suspended user cannot comment`; `editing comment stores revision`.
- [ ] **Step 2–5:** falhar, implementar, passar, commit `feat(db): comentários e revisões`.

### Task 6: Notificações, denúncias e moderação

**Files:** Create `supabase/migrations/20261123000600_notifications.sql`, `supabase/tests/database/05_notifications.test.sql`, `supabase/tests/database/06_moderation.test.sql`

**Interfaces:**
- Produces: `notifications(id, recipient_id, type notification_type, actor_id, target_type notification_target, target_id, read_at, created_at)`; `reports(id, reporter_id, target_type report_target, target_id, reason ≤ 1000, status report_status default 'open', resolved_by, resolved_at, created_at, unique(reporter_id, target_type, target_id))`; RPCs `admin_set_hidden(target report_target, target_id uuid, hidden boolean) returns void`, `admin_suspend_profile(profile_id uuid, suspended boolean) returns void`, `admin_set_demo_status(demo_id uuid, status demo_status) returns void`, `admin_resolve_report(report_id uuid, status report_status) returns void`, `admin_mark_duplicate(question_id uuid, original_id uuid) returns void`.
- Gatilhos de notificação: follow → `follow`; comentário → `comment` para o dono do alvo e `reply` para o autor do comentário pai; resposta → `answer`; aceitar → `accepted`; curtida → `like`; voto +1 → `vote`; "precisa de mais detalhes" → `detail_request`.

- [ ] **Step 1: testes** `follow notifies followee`; `no notification for own action`; `unlike removes unread like notification`; `recipient marks read, cannot change type`; `others cannot read my notifications`; `user can report once per target`; `reporter sees own report, others do not`; `non-admin calling admin_set_hidden fails`; `admin hides answer and it disappears for others`; `admin suspends profile and user can no longer post`; `notifications table in supabase_realtime publication`.
- [ ] **Step 2–5:** falhar, implementar, passar, commit `feat(db): notificações, denúncias e moderação`.

### Task 7: Funções de leitura (ordem das respostas, busca, feed) e tags iniciais

**Files:** Create `supabase/migrations/20261123000700_read_functions.sql`, `supabase/migrations/20261123000800_seed_tags.sql`, `supabase/tests/database/07_read_functions.test.sql`, `supabase/README.md`

**Interfaces:**
- Produces: as três funções do contrato, `language sql stable security invoker` (a RLS vale dentro delas).

`answers_ordered` ordena por:
```
1. outdated_flags >= 3                (falso antes de verdadeiro)
2. desafiante primeiro, depois aceita (desafiante = resposta criada depois da aceita
                                       com score >= 5 e score >= 2 * score da aceita;
                                       se houver várias, a de maior score, depois a mais nova)
3. score desc
4. created_at desc
```
`search_content`: `websearch_to_tsquery('portuguese', q)` para perguntas e projetos, `'simple'` para perfis; `kinds` nulo = todos (`question`, `project`, `profile`); `tag_slugs` nulo = sem filtro; ordena por `ts_rank` desc, limite 50.
`home_feed`: projetos e perguntas não ocultos de quem `auth.uid()` segue, das tags que segue e da própria pessoa, `created_at < coalesce(before, now())`, ordem `created_at desc`, `limit least(page_size, 50)`.

- [ ] **Step 1: testes da ordem (os quatro casos da 5.4 e os empates)**
  - `accepted first`: aceita score 0, outra score 3 → aceita primeiro.
  - `newer answer overtakes accepted`: aceita score 2, nova (depois da aceita) score 5 → nova primeiro; com score 4 → aceita primeiro; aceita score 3 e nova 5 → aceita primeiro (não é o dobro).
  - `older high answer does not overtake`: resposta mais antiga que a aceita, score 10 → aceita primeiro.
  - `tie goes to newer`: sem aceita, duas com score 1 → a mais nova primeiro.
  - `flagged sink`: score 9 com 3 marcações fica depois de score 0 sem marcação; a aceita com 3 marcações também desce.
  - `no accepted uses score`: sem aceita, ordem por score.
  - `search finds question by stemmed word` (`'componentes'` acha "componente"), `search filters by tag`, `search hides hidden content`.
  - `home_feed shows followed author and followed tag, not strangers`, `home_feed paginates by before`.
- [ ] **Step 2–4:** falhar, implementar, passar.
- [ ] **Step 5:** README em pt-BR (como rodar `scripts/test-db.sh`, como aplicar com `supabase db push` quando o Gabriel criar o projeto, tabela de regras de RLS).
- [ ] **Step 6:** Commit `feat(db): ordem das respostas, busca, feed e tags iniciais`.

### Task 8: Verificação e PR

- [ ] Rodar `scripts/test-db.sh` do zero e colar o resumo do `pg_prove` no PR.
- [x] Abrir PR para a branch padrão (era `claude/project-thread-850ls9`; desde 2026-11-23 a branch padrão é `main`) com o resumo das decisões acima.
