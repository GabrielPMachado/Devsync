-- Devsync: editar e excluir projetos.
--
-- Já existia: RLS de update/delete só para o autor, tags e curtidas em cascata,
-- comentários e revisões apagados por cleanup_target. Faltava:
--   1. trocar as tags do projeto num passo só (set_project_tags);
--   2. apagar a demo junto com o projeto (antes ficava órfã: demo_id on delete set null);
--   3. mandar a demo apagada para uma fila, que o serviço de demos esvazia
--      apagando os arquivos no R2 (demos/<id>/ e uploads/<id>/);
--   4. apagar as notificações que apontam para o conteúdo apagado.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 1. Tags do projeto -----------------------------------------------------------
-- security invoker: a RLS de project_tags vale. A checagem do autor vem antes
-- para dar erro claro (sem ela, apagar de outro projeto só não faria nada).
create or replace function public.set_project_tags(project_id uuid, tag_slugs text[])
returns void
language plpgsql set search_path = '' as $$
declare
  wanted uuid[];
begin
  if not exists (select 1 from public.projects p
                 where p.id = set_project_tags.project_id and p.author_id = (select auth.uid())) then
    raise exception 'Projeto não encontrado' using errcode = '42501';
  end if;
  if coalesce(cardinality(tag_slugs), 0) = 0 then
    raise exception 'Escolha ao menos 1 tag' using errcode = '22023';
  end if;
  if cardinality(tag_slugs) > 5 then
    raise exception 'Máximo de 5 tags' using errcode = 'DS003';
  end if;
  select array_agg(t.id) into wanted from public.tags t where t.slug = any (tag_slugs);
  if coalesce(cardinality(wanted), 0) <> (select count(distinct s) from unnest(tag_slugs) s) then
    raise exception 'Tag desconhecida' using errcode = '22023';
  end if;
  delete from public.project_tags pt where pt.project_id = set_project_tags.project_id and pt.tag_id <> all (wanted);
  insert into public.project_tags (project_id, tag_id)
    select set_project_tags.project_id, w from unnest(wanted) w
    on conflict do nothing;
end $$;

-- Fica aberta como as outras funções da API (private.apply_api_grants só reabre
-- para anon/authenticated o que public executa). Visitante cai no 42501 acima.
-- Grant por extenso: o projeto remoto não dá permissões automáticas.
grant execute on function public.set_project_tags(uuid, text[]) to anon, authenticated, service_role;

-- 2. Excluir o projeto apaga a demo dele -------------------------------------------
-- Só se nenhum outro projeto usar a mesma demo.
create or replace function private.projects_delete_demo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.demo_id is not null and not exists (select 1 from public.projects where demo_id = old.demo_id) then
    delete from public.demos where id = old.demo_id;
  end if;
  return null;
end $$;

revoke execute on function private.projects_delete_demo() from public, anon, authenticated;

drop trigger if exists projects_delete_demo on public.projects;
create trigger projects_delete_demo after delete on public.projects
  for each row execute function private.projects_delete_demo();

-- 3. Fila de limpeza do R2 --------------------------------------------------------
-- Fora da API (schema private). O serviço de demos lê e baixa pelas duas
-- funções abaixo, que só a service_role executa.
create table if not exists private.demo_deletions (
  demo_id uuid primary key,
  deleted_at timestamptz not null default now()
);
revoke all on private.demo_deletions from public, anon, authenticated;

create or replace function private.demos_queue_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Link não tem arquivos no R2.
  if old.kind = 'web_upload' then
    insert into private.demo_deletions (demo_id) values (old.id) on conflict do nothing;
  end if;
  return null;
end $$;

revoke execute on function private.demos_queue_deletion() from public, anon, authenticated;

drop trigger if exists demos_queue_deletion on public.demos;
create trigger demos_queue_deletion after delete on public.demos
  for each row execute function private.demos_queue_deletion();

create or replace function public.pending_demo_deletions(max_rows integer default 50)
returns setof uuid
language sql security definer set search_path = '' as $$
  select demo_id from private.demo_deletions order by deleted_at limit least(greatest(max_rows, 1), 200)
$$;

create or replace function public.finish_demo_deletions(demo_ids uuid[])
returns void
language sql security definer set search_path = '' as $$
  delete from private.demo_deletions where demo_id = any (demo_ids)
$$;

revoke execute on function public.pending_demo_deletions(integer), public.finish_demo_deletions(uuid[])
  from public, anon, authenticated;
grant execute on function public.pending_demo_deletions(integer), public.finish_demo_deletions(uuid[]) to service_role;

-- 4. Notificações do conteúdo apagado ----------------------------------------------
-- Mesma função de 20261123000500_comments, agora também apagando as
-- notificações que apontam para o alvo (projeto, pergunta, resposta, comentário).
create or replace function public.cleanup_target() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_argv[0] <> 'comment' then
    delete from public.comments where target_type = tg_argv[0]::public.comment_target and target_id = old.id;
  end if;
  delete from public.revisions where target_type = tg_argv[0]::public.revision_target and target_id = old.id;
  delete from public.notifications where target_type = tg_argv[0]::public.notification_target and target_id = old.id;
  return null;
end $$;

revoke execute on function public.cleanup_target() from public, anon, authenticated;
