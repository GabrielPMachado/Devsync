-- Perfil personalizado (parte 1): cargo, localização, status, banner, borda do
-- avatar e cor de destaque. Design: docs/superpowers/specs/2026-11-24-devsync-perfil-personalizado-design.md
-- As listas de chaves espelham src/lib/social/profile-style.ts.

alter table public.profiles
  add column headline text check (char_length(headline) <= 80),
  add column location text check (char_length(location) <= 60),
  add column status text check (status in ('open_to_work', 'building', 'learning', 'mentoring', 'freelance')),
  add column banner_url text,
  add column banner_preset text check (banner_preset in ('aurora', 'circuito', 'grade', 'ondas', 'noite', 'hex')),
  -- Só o formato aqui; quais bordas a pessoa liberou é checado pela migration das insígnias.
  add column avatar_frame text check (avatar_frame ~ '^[a-z0-9_]{1,30}$'),
  add column accent text check (accent in ('azul', 'ciano', 'violeta', 'verde', 'ambar', 'rosa'));

-- Foto e banner só podem apontar para a pasta da própria pessoa no Storage
-- (ou continuar como estão, ex.: a foto do GitHub do cadastro).
create function private.is_own_image_url(url text, bucket text, owner uuid) returns boolean
language sql immutable set search_path = '' as $$
  select url ~ ('^https?://[^/?#]+/storage/v1/object/public/' || bucket || '/' || owner::text
                || '/[A-Za-z0-9._-]+(\?v=[0-9]{1,20})?$')
$$;

create function private.guard_profile_images() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.avatar_url is distinct from old.avatar_url and new.avatar_url is not null
     and not private.is_own_image_url(new.avatar_url, 'avatars', new.id) then
    raise exception 'foto de perfil precisa estar na sua pasta do Storage' using errcode = '22023';
  end if;
  if new.banner_url is distinct from old.banner_url and new.banner_url is not null
     and not private.is_own_image_url(new.banner_url, 'banners', new.id) then
    raise exception 'banner precisa estar na sua pasta do Storage' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger profiles_image_urls_guard before update of avatar_url, banner_url on public.profiles
  for each row execute function private.guard_profile_images();

revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, bio, links, locale, headline, location, status, banner_url, banner_preset, avatar_frame, accent) on public.profiles to authenticated;

-- A função de permissões (PR #11) passa a conhecer as colunas novas.
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

-- Bucket de banners (igual ao de avatares, com 4 MB).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets não existe: bucket de banners não criado';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('banners', 'banners', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$
    create policy "banner: dono envia" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'banners'
                  and (storage.foldername(name))[1] = (select auth.uid())::text
                  and (select public.is_active_user()))
  $p$;
  execute $p$
    create policy "banner: dono troca" on storage.objects
      for update to authenticated
      using (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy "banner: dono apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
end $$;
