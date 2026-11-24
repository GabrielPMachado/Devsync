-- Devsync: a pessoa lista e lê (pela API) a própria pasta de fotos e banners.
-- Sem SELECT, o Storage não lista nem apaga nada: salvar o perfil não
-- conseguia limpar as imagens antigas (órfãos) e "Remover foto" deixava o
-- arquivo. As imagens continuam públicas pela URL pública dos buckets.
-- O Postgres de teste sem Supabase (scripts/test-db.sh) não tem o schema
-- storage: lá esta migração não faz nada.

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects não existe: políticas de leitura não criadas';
    return;
  end if;

  execute $p$
    create policy "avatar: dono lê" on storage.objects
      for select to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy "banner: dono lê" on storage.objects
      for select to authenticated
      using (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
end $$;
