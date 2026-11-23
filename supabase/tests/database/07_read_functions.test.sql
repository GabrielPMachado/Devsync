begin;
\ir ../helpers.psql
select plan(25);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select tests.create_user('carla@x.dev', 'carla') as carla \gset
select tests.create_user('dora@x.dev', 'dora') as dora \gset

-- Monta cenários direto como dono do banco (fora da RLS), com datas controladas.
create function tests.mkq(author uuid) returns uuid language sql as $$
  insert into public.questions (author_id, title, body_md) values (author, 'Pergunta de teste da ordem', 'x') returning id
$$;
create function tests.mka(q uuid, label text, score int, minutes_ago int, flags int default 0) returns uuid language sql as $$
  insert into public.answers (question_id, author_id, body_md, score, outdated_flags, created_at)
  select q, author_id, label, score, flags, now() - make_interval(mins => minutes_ago)
  from public.questions where id = q returning id
$$;
create function tests.accept(q uuid, a uuid) returns void language sql as $$
  update public.questions set accepted_answer_id = a where id = q
$$;
create function tests.order_of(q uuid) returns text[] language sql as $$
  select array_agg(o.body_md order by o.ord) from public.answers_ordered(q) with ordinality as o(id, question_id, author_id, body_md, demo_id, tech_version, lang, score, outdated_flags, comments_count, hidden_at, created_at, updated_at, ord)
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Ordem das respostas (seção 5.4) --------------------------------------------
select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 0, 60));
select tests.mka(:'q', 'B', 3, 30);
select is(tests.order_of(:'q'), array['A', 'B'], 'accepted first, even with fewer votes');

select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 2, 60));
select tests.mka(:'q', 'N', 5, 30);
select is(tests.order_of(:'q'), array['N', 'A'], 'newer answer with >= 5 and >= 2x overtakes accepted');

select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 2, 60));
select tests.mka(:'q', 'N', 4, 30);
select is(tests.order_of(:'q'), array['A', 'N'], 'newer answer below 5 does not overtake');

select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 3, 60));
select tests.mka(:'q', 'N', 5, 30);
select is(tests.order_of(:'q'), array['A', 'N'], 'newer answer below double does not overtake');

select tests.mkq(:'ana') as q \gset
select tests.mka(:'q', 'O', 10, 90);
select tests.accept(:'q', tests.mka(:'q', 'A', 0, 60));
select is(tests.order_of(:'q'), array['A', 'O'], 'older high answer does not overtake');

select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 1, 60));
select tests.mka(:'q', 'N1', 6, 40);
select tests.mka(:'q', 'N2', 8, 30);
select is(tests.order_of(:'q'), array['N2', 'A', 'N1'], 'only the strongest challenger overtakes');

select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 1, 60));
select tests.mka(:'q', 'N', 9, 30, 3);
select is(tests.order_of(:'q'), array['A', 'N'], 'flagged challenger does not overtake and sinks');

select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 1, 60));
select tests.mka(:'q', 'N1', 8, 40);
select tests.mka(:'q', 'N2', 8, 30);
select is(tests.order_of(:'q'), array['N2', 'A', 'N1'], 'challenger tie goes to newer');

select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 0, 60));
select tests.mka(:'q', 'D', -2, 50);
select tests.mka(:'q', 'E', 0, 40);
select is(tests.order_of(:'q'), array['A', 'E', 'D'], 'negative score sorts last among unflagged');

select tests.mkq(:'ana') as q \gset
select tests.mka(:'q', 'X', 1, 60);
select tests.mka(:'q', 'Y', 1, 30);
select is(tests.order_of(:'q'), array['Y', 'X'], 'tie goes to newer');

select tests.mkq(:'ana') as q \gset
select tests.mka(:'q', 'P', 1, 60);
select tests.mka(:'q', 'Q', 4, 50);
select tests.mka(:'q', 'R', 2, 40);
select is(tests.order_of(:'q'), array['Q', 'R', 'P'], 'no accepted uses score');

select tests.mkq(:'ana') as q \gset
select tests.mka(:'q', 'F', 9, 60, 3);
select tests.mka(:'q', 'Z', 0, 30);
select is(tests.order_of(:'q'), array['Z', 'F'], 'flagged answers sink below unflagged');

select tests.mkq(:'ana') as q \gset
select tests.accept(:'q', tests.mka(:'q', 'A', 5, 60, 3));
select tests.mka(:'q', 'Z', 0, 30);
select is(tests.order_of(:'q'), array['Z', 'A'], 'flagged accepted answer also sinks');

select tests.mkq(:'ana') as q \gset
select tests.mka(:'q', 'V', 0, 60);
select tests.mka(:'q', 'H', 50, 30) as h \gset
update answers set hidden_at = now() where id = :'h';
select tests.as_anon();
select is(tests.order_of(:'q'), array['V'], 'hidden answers do not appear');
reset role;

-- Busca ----------------------------------------------------------------------
insert into tags (slug, name) values ('react', 'React'), ('rust', 'Rust') on conflict (slug) do nothing;
insert into questions (author_id, title, body_md) values (:'bruno', 'Dúvida sobre componente funcional', 'Como passar props?') returning id as sq \gset
insert into question_tags select :'sq', id from tags where slug = 'react';
insert into questions (author_id, title, body_md) values (:'bruno', 'Outro componente, agora em Rust', 'x') returning id as sq2 \gset
insert into questions (author_id, title, body_md, hidden_at) values (:'bruno', 'Componente escondido pela moderação', 'x', now()) returning id as sq3 \gset
insert into projects (author_id, title, description_md) values (:'carla', 'Biblioteca de componentes', 'UI kit') returning id as sp \gset
update profiles set bio = 'Gosto de componentes' where id = :'dora';

select tests.as_anon();
select ok(exists (select 1 from search_content('componentes', null, null) where kind = 'question' and id = :'sq'), 'search finds question by stemmed word');
select ok(exists (select 1 from search_content('componentes', null, null) where kind = 'project' and id = :'sp'), 'search finds project');
select ok(exists (select 1 from search_content('dora', null, array['profile']) where kind = 'profile' and id = :'dora'), 'search finds profile by username');
select is((select array_agg(id) from search_content('componentes', array['react'], array['question'])), array[:'sq'::uuid], 'search filters by tag and kind');
select ok(not exists (select 1 from search_content('componentes', null, null) where id = :'sq3'), 'search hides hidden content');
select is((select title from search_content('componentes', null, array['question']) order by rank desc limit 1)::text is not null, true, 'search returns titles');

-- Feed -----------------------------------------------------------------------
reset role;
insert into follows (follower_id, followee_id) values (:'ana', :'bruno');
insert into tag_follows (profile_id, tag_id) select :'ana', id from tags where slug = 'rust';
insert into question_tags select :'sq2', id from tags where slug = 'rust';
insert into projects (author_id, title, created_at) values (:'dora', 'Projeto de estranha', now() - interval '1 minute') returning id as stranger \gset
insert into projects (author_id, title, created_at) values (:'bruno', 'Projeto do Bruno', now() - interval '2 minutes') returning id as bproj \gset
insert into questions (author_id, title, body_md, created_at) values (:'carla', 'Pergunta da Carla com tag rust', 'x', now() - interval '3 minutes') returning id as cq \gset
insert into question_tags select :'cq', id from tags where slug = 'rust';

select tests.login_as(:'ana');
select ok(exists (select 1 from home_feed(null, 50) where id = :'bproj'), 'home_feed shows followed author');
select ok(exists (select 1 from home_feed(null, 50) where id = :'cq'), 'home_feed shows followed tag');
select ok(not exists (select 1 from home_feed(null, 50) where id = :'stranger'), 'home_feed hides strangers');
select ok(not exists (select 1 from home_feed(now() - interval '150 seconds', 50) where id = :'bproj')
          and exists (select 1 from home_feed(now() - interval '150 seconds', 50) where id = :'cq'), 'home_feed paginates by before');

-- Tags iniciais.
select ok(exists (select 1 from tags where slug = 'iniciante'), 'tag iniciante vem pronta');

select * from finish();
rollback;
