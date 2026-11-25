-- Devsync: capa própria do projeto (imagem 16:9 recortada no navegador) e print
-- automático da demo para projetos sem capa.
-- A coluna projects.cover_url já existia (e já está nas permissões de insert/update);
-- aqui entram o bucket e a regra de que a capa só aponta para a pasta do autor.
-- Caminho no Storage: project-covers/<id do autor>/cover-<ts>.webp

create function private.guard_project_cover() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cover_url is not null
     and (tg_op = 'INSERT' or new.cover_url is distinct from old.cover_url)
     and not private.is_own_image_url(new.cover_url, 'project-covers', new.author_id) then
    raise exception 'a capa precisa estar na sua pasta do Storage' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger projects_cover_guard before insert or update of cover_url on public.projects
  for each row execute function private.guard_project_cover();

-- Bucket público de capas (4 MB, como os banners). O dono envia, lê, troca e apaga
-- só dentro da própria pasta. O Postgres de teste sem Supabase não tem o schema storage.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets não existe: bucket de capas não criado';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('project-covers', 'project-covers', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$
    create policy "capa: dono envia" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'project-covers'
                  and (storage.foldername(name))[1] = (select auth.uid())::text
                  and (select public.is_active_user()))
  $p$;
  execute $p$
    create policy "capa: dono lê" on storage.objects
      for select to authenticated
      using (bucket_id = 'project-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy "capa: dono troca" on storage.objects
      for update to authenticated
      using (bucket_id = 'project-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'project-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy "capa: dono apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'project-covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
end $$;

-- Print automático da demo ------------------------------------------------------------
-- Projeto sem capa ganha um print da demo, tirado pelo serviço de demos (Cloudflare
-- Browser Rendering, cota grátis diária). demos.screenshot_url já existia; aqui entram
-- a versão do print e as tentativas (desiste depois de 3 falhas na mesma versão).
-- Usuários não gravam nada disso: as colunas não estão nos grants de demos.
alter table public.demos
  add column screenshot_version integer,
  add column screenshot_tries smallint not null default 0,
  add column screenshot_try_version integer;

-- Fila: demos no ar, de projetos sem capa, sem print da versão atual.
create function public.pending_demo_previews(max_rows integer default 3)
returns table (id uuid, kind public.demo_kind, url text, version integer)
language sql stable security definer set search_path = '' as $$
  select d.id, d.kind, case when d.kind = 'web_link' then d.url end, d.version
  from public.demos d
  where d.status = 'live'
    and d.screenshot_version is distinct from d.version
    and (d.screenshot_try_version is distinct from d.version or d.screenshot_tries < 3)
    and exists (select 1 from public.projects p where p.demo_id = d.id and p.cover_url is null)
  order by d.updated_at
  limit least(greatest(max_rows, 1), 20)
$$;

-- Resultado: preview_url = o print; null = falhou (conta uma tentativa). Versão velha é ignorada.
create function public.record_demo_preview(demo_id uuid, demo_version integer, preview_url text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if preview_url is not null and preview_url !~ '^https://' then
    raise exception 'print precisa de URL https' using errcode = '22023';
  end if;
  if preview_url is not null then
    update public.demos
       set screenshot_url = preview_url, screenshot_version = demo_version, screenshot_tries = 0, screenshot_try_version = demo_version
     where id = demo_id and version = demo_version;
  else
    update public.demos
       set screenshot_tries = case when screenshot_try_version = demo_version then screenshot_tries + 1 else 1 end,
           screenshot_try_version = demo_version
     where id = demo_id and version = demo_version;
  end if;
end $$;

revoke execute on function public.pending_demo_previews(integer), public.record_demo_preview(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.pending_demo_previews(integer), public.record_demo_preview(uuid, integer, text) to service_role;

-- Demo de link com print também tem arquivo no R2 (previews/<id>/): entra na limpeza.
create or replace function private.demos_queue_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.kind = 'web_upload' or old.screenshot_url is not null then
    insert into private.demo_deletions (demo_id) values (old.id) on conflict do nothing;
  end if;
  return null;
end $$;
