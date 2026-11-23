begin;
\ir ../helpers.psql
select plan(2);

-- Toda FK em public tem índice começando pelas suas colunas (lint do Supabase
-- "unindexed_foreign_keys").
select is(
  (select array_agg(c.conrelid::regclass::text || '.' || a.attname order by 1)
   from pg_constraint c
   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
   where c.contype = 'f' and c.connamespace = 'public'::regnamespace
     and not exists (
       select 1 from pg_index i
       where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])),
  null,
  'every foreign key has an index');

-- Políticas chamam auth.uid()/is_admin()/is_active_user() dentro de (select ...),
-- para o Postgres avaliar uma vez por consulta e não por linha (lint
-- "auth_rls_initplan").
select is(
  (select array_agg(tablename || ': ' || policyname order by 1)
   from pg_policies
   where schemaname = 'public'
     and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
           '\(\s*SELECT\s+(auth\.uid\(\)|is_admin\(\)|is_active_user\(\))[^)]*\)', '', 'gi')
         ~ '(auth\.uid\(\)|is_admin\(\)|is_active_user\(\))'),
  null,
  'policies wrap auth helpers in (select ...)');

select * from finish();
rollback;
