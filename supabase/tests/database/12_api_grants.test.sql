begin;
\ir ../helpers.psql
select plan(4);

-- O projeto no Supabase remoto foi criado sem dar permissão automática às
-- tabelas novas (anon, authenticated e service_role ficaram sem SELECT etc.).
-- Aqui no Supabase local a permissão vem automática, então o teste simula o
-- remoto: guarda as permissões de hoje, tira tudo e roda a migration
-- 20261124400000_api_grants (private.apply_api_grants). O resultado tem de ser igual ao de antes.

create temp table esperado as
select r.rolname, c.relname, p.priv,
       has_table_privilege(r.rolname, c.oid, p.priv) as pode
from pg_class c
cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v');

create temp table esperado_colunas as
select r.rolname, a.attrelid::regclass::text as tabela, a.attname::text as coluna, p.priv,
       has_column_privilege(r.rolname, a.attrelid, a.attnum, p.priv) as pode
from pg_attribute a
join pg_class c on c.oid = a.attrelid
cross join (values ('anon'), ('authenticated')) r(rolname)
cross join (values ('INSERT'), ('UPDATE')) p(priv)
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  and a.attnum > 0 and not a.attisdropped;

create temp table esperado_funcoes as
select r.rolname, p.oid::regprocedure::text as funcao,
       has_function_privilege(r.rolname, p.oid, 'EXECUTE') as pode
from pg_proc p
cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
where p.pronamespace = 'public'::regnamespace;

-- Simula o remoto.
revoke all on all tables in schema public from anon, authenticated, service_role;
revoke execute on all functions in schema public from anon, authenticated, service_role;

select ok(not has_table_privilege('authenticated', 'public.tags', 'SELECT'),
  'simulação: sem permissão, ninguém lê as tags (o bug do cadastro)');

select lives_ok($$ select private.apply_api_grants() $$, 'reaplica as permissões');

select set_eq(
  $$ select rolname, relname::text, priv, pode from esperado $$,
  $$ select r.rolname, c.relname::text, p.priv, has_table_privilege(r.rolname, c.oid, p.priv)
     from pg_class c
     cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
     cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v') $$,
  'tabelas: mesmas permissões do Supabase local');

select set_eq(
  $$ select rolname, tabela, coluna, priv, pode from esperado_colunas
     union all
     select rolname, funcao, '', 'EXECUTE', pode from esperado_funcoes $$,
  $$ select r.rolname, a.attrelid::regclass::text, a.attname::text, p.priv,
            has_column_privilege(r.rolname, a.attrelid, a.attnum, p.priv)
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     cross join (values ('anon'), ('authenticated')) r(rolname)
     cross join (values ('INSERT'), ('UPDATE')) p(priv)
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
       and a.attnum > 0 and not a.attisdropped
     union all
     select r.rolname, p.oid::regprocedure::text, '', 'EXECUTE', has_function_privilege(r.rolname, p.oid, 'EXECUTE')
     from pg_proc p
     cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
     where p.pronamespace = 'public'::regnamespace $$,
  'colunas e funções: mesmas permissões do Supabase local');

select * from finish();
rollback;
