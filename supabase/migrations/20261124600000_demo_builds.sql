-- Devsync: build automático de demos a partir de um repositório público do GitHub.
-- O serviço de demos cria a linha e grava o progresso (service_role); o dono só lê.
-- Design: docs/superpowers/specs/2026-11-24-devsync-build-de-demos-design.md

create type public.build_stage as enum (
  'queued', 'cloning', 'installing', 'building', 'uploading', 'validating', 'ready', 'failed'
);

create table public.demo_builds (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null unique references public.demos (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  repo text not null check (repo ~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'),
  ref text not null check (char_length(ref) between 1 and 255),
  stage public.build_stage not null default 'queued',
  framework text check (char_length(framework) <= 40),
  -- Código do erro (ex.: 'build_failed', 'no_output') e o fim do log.
  error text check (char_length(error) <= 60),
  log text check (char_length(log) <= 8000),
  -- Run do GitHub Actions que assumiu este build (o primeiro que falou com o serviço).
  run_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index demo_builds_owner_idx on public.demo_builds (owner_id, created_at desc);

create trigger demo_builds_updated_at before update on public.demo_builds
  for each row execute function public.set_updated_at();

alter table public.demo_builds enable row level security;
create policy demo_builds_select_own on public.demo_builds
  for select to authenticated using (owner_id = (select auth.uid()));

-- Permissões por extenso (o projeto remoto não dá nada por padrão; ver 20261124400000).
revoke all on public.demo_builds from anon, authenticated;
grant select on public.demo_builds to authenticated;
grant select, insert, update, delete on public.demo_builds to service_role;

-- O resultado da validação do zip vira o fim do build.
create function public.demos_sync_build() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'live' then
    update public.demo_builds set stage = 'ready', error = null
      where demo_id = new.id and stage <> 'ready';
  elsif new.status in ('unavailable', 'blocked') then
    update public.demo_builds
      set stage = 'failed', error = coalesce(error, new.rejection_reason, new.status::text)
      where demo_id = new.id and stage <> 'failed';
  end if;
  return new;
end $$;

revoke execute on function public.demos_sync_build() from public, anon, authenticated;

create trigger demos_sync_build after update of status on public.demos
  for each row when (old.status is distinct from new.status)
  execute function public.demos_sync_build();

-- Mantém private.apply_api_grants() completa (última versão: 20261124500000):
-- rodar de novo não pode abrir demo_builds para escrita.
create or replace function private.apply_api_grants() returns void
language plpgsql set search_path = '' as $fn$
declare
  f regprocedure;
begin
  grant select, insert, update, delete, truncate, references, trigger
    on all tables in schema public to anon, authenticated, service_role;
  grant usage, select, update on all sequences in schema public to anon, authenticated, service_role;

  -- Repetição dos revokes/grants das migrations anteriores, na ordem original.
  revoke insert, update, delete on public.revisions from anon, authenticated;
  revoke insert, update, delete on public.profiles from anon, authenticated;
  grant update (username, display_name, avatar_url, bio, links, locale,
    headline, location, status, banner_url, banner_preset, avatar_frame, accent) on public.profiles to authenticated;
  revoke insert, update, delete on public.tags from anon;
  revoke insert, update on public.tags from authenticated;
  grant insert (slug, name, description) on public.tags to authenticated;
  grant update (name, description) on public.tags to authenticated;
  revoke insert, update, delete on public.profile_tags, public.tag_follows from anon;
  revoke update on public.profile_tags, public.tag_follows from authenticated;
  revoke insert, update, delete on public.follows from anon;
  revoke update on public.follows from authenticated;
  revoke all on public.demo_uploads from anon, authenticated;
  revoke insert, update, delete on public.demos from anon;
  revoke insert, update on public.demos from authenticated;
  grant insert (kind, url) on public.demos to authenticated;
  grant update (url) on public.demos to authenticated;
  revoke insert, update, delete on public.projects from anon;
  revoke insert, update on public.projects from authenticated;
  grant insert (title, description_md, repo_url, site_url, cover_url, demo_id, lang) on public.projects to authenticated;
  grant update (title, description_md, repo_url, site_url, cover_url, demo_id, lang) on public.projects to authenticated;
  revoke insert, update, delete on public.project_tags from anon;
  revoke update on public.project_tags from authenticated;
  revoke insert, update, delete on public.likes from anon;
  revoke update on public.likes from authenticated;
  revoke insert, update, delete on public.questions from anon;
  revoke insert, update on public.questions from authenticated;
  grant insert (title, body_md, project_id, lang) on public.questions to authenticated;
  grant update (title, body_md, project_id, accepted_answer_id, lang) on public.questions to authenticated;
  revoke insert, update, delete on public.question_tags from anon;
  revoke update on public.question_tags from authenticated;
  revoke insert, update, delete on public.answers from anon;
  revoke insert, update on public.answers from authenticated;
  grant insert (question_id, body_md, demo_id, tech_version, lang) on public.answers to authenticated;
  grant update (body_md, demo_id, tech_version) on public.answers to authenticated;
  revoke insert, update, delete on public.answer_votes from anon;
  revoke insert, update on public.answer_votes from authenticated;
  grant insert (answer_id, value) on public.answer_votes to authenticated;
  grant update (value) on public.answer_votes to authenticated;
  revoke insert, update, delete on public.outdated_flags from anon;
  revoke insert, update on public.outdated_flags from authenticated;
  grant insert (answer_id) on public.outdated_flags to authenticated;
  revoke insert, update, delete on public.detail_requests from anon;
  revoke insert, update on public.detail_requests from authenticated;
  grant insert (question_id) on public.detail_requests to authenticated;
  revoke insert, update, delete on public.comments from anon;
  revoke insert, update on public.comments from authenticated;
  grant insert (target_type, target_id, parent_id, body_md) on public.comments to authenticated;
  grant update (body_md) on public.comments to authenticated;
  revoke insert, update, delete on public.notifications from anon;
  revoke insert, update on public.notifications from authenticated;
  grant update (read_at) on public.notifications to authenticated;
  revoke insert, update, delete on public.reports from anon;
  revoke insert, update, delete on public.reports from authenticated;
  grant insert (target_type, target_id, reason) on public.reports to authenticated;
  revoke insert, update, delete on public.blocked_domains from anon, authenticated;

  -- 20261124600000_demo_builds: o dono só lê; o serviço de demos escreve.
  revoke all on public.demo_builds from anon, authenticated;
  grant select on public.demo_builds to authenticated;

  -- Funções. Sem o padrão antigo, authenticated nunca ganhou EXECUTE nas
  -- funções de admin (as migrations só tiravam de public e anon). Elas mesmas
  -- conferem se quem chama é admin (assert_admin).
  grant execute on function
    public.admin_set_hidden(public.report_target, uuid, boolean),
    public.admin_suspend_profile(uuid, boolean),
    public.admin_set_demo_status(uuid, public.demo_status),
    public.admin_resolve_report(uuid, public.report_status),
    public.admin_mark_duplicate(uuid, uuid),
    public.admin_block_domain(text, text),
    public.admin_unblock_domain(text),
    public.admin_report_queue(public.report_status),
    public.admin_resolve_target(public.report_target, uuid, public.report_status)
    to authenticated;

  -- service_role (Worker de demos e tarefas do servidor) executa tudo, como no
  -- padrão antigo.
  grant execute on all functions in schema public to service_role;

  -- As funções que ficam abertas (leitura, RLS) continuam valendo para anon e
  -- authenticated. Só as que já estavam abertas a public: as fechadas seguem
  -- fechadas porque o revoke delas tirou de public, anon e authenticated.
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('public', p.oid, 'execute')
  loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;

  -- Tabelas, sequências e funções criadas daqui em diante pelo dono das
  -- migrations (postgres) seguem o padrão antigo, igual ao Supabase local.
  alter default privileges for role postgres in schema public
    grant select, insert, update, delete, truncate, references, trigger on tables to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant usage, select, update on sequences to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant execute on functions to anon, authenticated, service_role;
end
$fn$;

revoke execute on function private.apply_api_grants() from public, anon, authenticated;
