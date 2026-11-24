begin;
\ir ../helpers.psql
select plan(11);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select tests.create_user('carla@x.dev', 'carla') as carla \gset
select tests.create_user('dora@x.dev', 'dora') as dora \gset
select tests.create_user('edu@x.dev', 'edu') as edu \gset
select tests.create_user('semnome@x.dev') as semnome \gset

-- Cenário montado como dono do banco (fora da RLS), com datas controladas.
create function tests.mkp(author uuid, title text) returns uuid language sql as $$
  insert into public.projects (author_id, title) values (author, title) returning id
$$;
create function tests.like_at(who uuid, project uuid, days_ago int) returns void language sql as $$
  insert into public.likes (profile_id, project_id, created_at) values (who, project, now() - make_interval(days => days_ago))
$$;
create function tests.trending(n int default 12) returns text[] language sql as $$
  select coalesce(array_agg(p.title order by t.ord), '{}') from public.trending_projects(n) with ordinality as t(id, score, ord)
  join public.projects p on p.id = t.id
$$;
create function tests.suggested(n int default 5) returns text[] language sql as $$
  select coalesce(array_agg(p.username order by s.ord), '{}') from public.suggested_profiles(n) with ordinality as s(id, ord)
  join public.profiles p on p.id = s.id
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Projetos em alta ------------------------------------------------------------
select tests.mkp(:'ana', 'Novo quente') as p1 \gset
select tests.mkp(:'bruno', 'Velho famoso') as p2 \gset
select tests.mkp(:'carla', 'Sem curtidas') as p3 \gset
select tests.mkp(:'dora', 'Oculto') as p4 \gset
select tests.like_at(:'bruno', :'p1', 0);
select tests.like_at(:'carla', :'p1', 0);
select tests.like_at(:'ana', :'p2', 10);
select tests.like_at(:'carla', :'p2', 10);
select tests.like_at(:'dora', :'p2', 10);
select tests.like_at(:'ana', :'p4', 0);
select tests.like_at(:'bruno', :'p4', 0);
select tests.like_at(:'carla', :'p4', 0);
update public.projects set hidden_at = now() where id = :'p4';

select tests.as_anon();
select is(tests.trending(), array['Novo quente', 'Velho famoso', 'Sem curtidas'],
  'recent likes win; old likes only break ties; hidden projects never appear');
select is(tests.trending(1), array['Novo quente'], 'page_size limits the result');
select is(tests.trending(0), array['Novo quente'], 'page_size below 1 becomes 1');

select tests.login_as(:'dora');
select ok(not ('Oculto' = any (tests.trending())), 'hidden project stays out even for its author');

-- Quem seguir -----------------------------------------------------------------
reset role;
-- Ana usa react; Carla também. Bruno tem mais seguidores, mas nada em comum.
insert into public.profile_tags (profile_id, tag_id)
  select :'ana'::uuid, id from public.tags where slug = 'react'
  union all select :'carla'::uuid, id from public.tags where slug = 'react';
insert into public.follows (follower_id, followee_id) values (:'carla', :'bruno'), (:'dora', :'bruno'), (:'ana', :'dora');
update public.profiles set suspended_at = now() where id = :'edu';

select tests.login_as(:'ana');
select ok(not ('ana' = any (tests.suggested(50))), 'never suggests the viewer');
select ok(not ('dora' = any (tests.suggested(50))), 'never suggests someone already followed');
select ok(not ('edu' = any (tests.suggested(50))), 'never suggests suspended profiles');
select is((select count(*) from public.suggested_profiles(50) s join public.profiles p on p.id = s.id where p.username is null), 0::bigint,
  'never suggests profiles without @');
select is(tests.suggested(2), array['carla', 'bruno'], 'shared technologies first, then followers');

-- Tags acompanhadas também contam como interesse de quem chama.
reset role;
-- Fábio é o mais seguido de todos, mas não usa react; Dora acompanha react.
select tests.create_user('fabio@x.dev', 'fabio') as fabio \gset
insert into public.follows (follower_id, followee_id) values (:'ana', :'fabio'), (:'bruno', :'fabio'), (:'carla', :'fabio');
insert into public.tag_follows (profile_id, tag_id) select :'dora'::uuid, id from public.tags where slug = 'react';
select tests.login_as(:'dora');
select ok((tests.suggested(1))[1] in ('ana', 'carla'), 'followed tags count as shared interest');

select tests.as_anon();
select is((tests.suggested(1))[1], 'fabio', 'visitors get the most followed');

select * from finish();
rollback;
