-- Devsync: bucket de fotos de perfil (Supabase Storage).
-- Cada pessoa só grava dentro da própria pasta: avatars/<id do usuário>/...
-- Leitura pública (a foto aparece para visitantes).
-- O Postgres de teste sem Supabase (scripts/test-db.sh) não tem o schema
-- storage: lá esta migração não faz nada.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage.buckets não existe: bucket de avatares não criado';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152,
          array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$
    create policy "avatar: dono envia" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'avatars'
                  and (storage.foldername(name))[1] = (select auth.uid())::text
                  and (select public.is_active_user()))
  $p$;
  execute $p$
    create policy "avatar: dono troca" on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy "avatar: dono apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
end $$;
