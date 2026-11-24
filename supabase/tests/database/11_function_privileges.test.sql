begin;
\ir ../helpers.psql
select plan(5);

-- Funções de gatilho só rodam pelo gatilho. Ninguém de fora (anon ou
-- authenticated) pode chamá-las por /rest/v1/rpc (lints 0028 e 0029 do Supabase).
select is(
  (select array_agg(p.proname::text order by 1)
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prorettype = 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon não executa nenhuma função de gatilho');

select is(
  (select array_agg(p.proname::text order by 1)
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prorettype = 'trigger'::regtype
     and has_function_privilege('authenticated', p.oid, 'execute')),
  null,
  'authenticated não executa nenhuma função de gatilho');

-- assert_admin só é chamada de dentro das funções de admin (security definer).
select ok(not has_function_privilege('anon', 'public.assert_admin()', 'execute'), 'anon não chama assert_admin');
select ok(not has_function_privilege('authenticated', 'public.assert_admin()', 'execute'), 'authenticated não chama assert_admin');

-- Os gatilhos continuam funcionando para quem está logado: criar uma pergunta
-- dispara o gatilho de revisão e o de contadores.
select tests.create_user('lia@x.dev', 'lia') as lia \gset
select tests.login_as(:'lia');
insert into questions (title, body_md) values ('Gatilho ainda funciona?', 'texto da pergunta para o teste') returning id as q \gset
select lives_ok(
  format($$insert into answers (question_id, body_md) values (%L, 'resposta que dispara os gatilhos')$$, :'q'),
  'gatilhos disparam para usuário logado sem EXECUTE direto');

select * from finish();
rollback;
