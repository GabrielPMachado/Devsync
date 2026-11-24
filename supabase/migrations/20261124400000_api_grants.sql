-- Permissões da API (anon, authenticated, service_role) escritas por extenso.
--
-- As migrations anteriores contavam com o padrão antigo do Supabase: toda
-- tabela nova em public já nascia com SELECT/INSERT/UPDATE/DELETE para anon,
-- authenticated e service_role, e cada migration só tirava o que não queria.
-- O projeto remoto foi criado com o padrão novo, que não dá nada. Resultado:
-- o site não lia nenhuma tabela (o cadastro mostrava "Que assuntos você quer
-- acompanhar?" sem nenhum assunto).
--
-- Esta migration chega ao mesmo estado nos dois lugares: dá tudo e repete, na
-- mesma ordem, cada revoke/grant das migrations anteriores. No Supabase local
-- não muda nada. Fica numa função em private (fora da API) para o teste
-- 12_api_grants.test.sql simular o remoto e conferir, e para dar para rodar
-- de novo se algum dia o problema voltar: select private.apply_api_grants();
-- Só mexe em permissões: não apaga nem altera dados.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

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
  grant update (username, display_name, avatar_url, bio, links, locale) on public.profiles to authenticated;
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

select private.apply_api_grants();
