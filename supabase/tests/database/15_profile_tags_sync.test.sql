begin;
\ir ../helpers.psql
select plan(7);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
create function tests.slugs(tbl text, who uuid) returns text[] language plpgsql security definer set search_path = '' as $$
declare r text[];
begin
  execute format('select coalesce(array_agg(t.slug order by t.slug), ''{}'') from public.%I x join public.tags t on t.id = x.tag_id where x.profile_id = $1', tbl)
    into r using who;
  return r;
end $$;
create function tests.tag(slug text) returns uuid language sql security definer set search_path = '' as $$
  select id from public.tags where tags.slug = tag.slug
$$;
grant execute on all functions in schema tests to anon, authenticated;

select tests.login_as(:'ana');

-- Assuntos do cadastro (acompanhar) também marcam as tecnologias do perfil.
insert into public.tag_follows (profile_id, tag_id) values (:'ana', tests.tag('react')), (:'ana', tests.tag('css'));
select is(tests.slugs('profile_tags', :'ana'), array['css', 'react'], 'acompanhar um assunto marca a tecnologia no perfil');

delete from public.tag_follows where profile_id = :'ana' and tag_id = tests.tag('css');
select is(tests.slugs('profile_tags', :'ana'), array['react'], 'deixar de acompanhar desmarca a tecnologia');

-- E o contrário: escolher no editor de perfil passa a acompanhar.
insert into public.profile_tags (profile_id, tag_id) values (:'ana', tests.tag('typescript'));
select is(tests.slugs('tag_follows', :'ana'), array['react', 'typescript'], 'marcar tecnologia no perfil passa a acompanhar o assunto');

delete from public.profile_tags where profile_id = :'ana' and tag_id = tests.tag('react');
select is(tests.slugs('tag_follows', :'ana'), array['typescript'], 'desmarcar tecnologia deixa de acompanhar');
select is(tests.slugs('profile_tags', :'ana'), array['typescript'], 'as duas listas ficam iguais');

-- Repetir não dá erro (sem laço entre os gatilhos).
select lives_ok($$ insert into public.tag_follows (profile_id, tag_id) values (current_setting('request.jwt.claim.sub')::uuid, tests.tag('typescript')) on conflict do nothing $$,
  'acompanhar de novo não quebra');

-- Ninguém mexe nos assuntos de outra pessoa pelo gatilho.
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select throws_ok(format($$ insert into public.tag_follows (profile_id, tag_id) values (%L, tests.tag('css')) $$, :'bruno'), '42501', null,
  'não dá para acompanhar no lugar de outra pessoa');

select * from finish();
rollback;
