begin;
\ir ../helpers.psql
select plan(17);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select tests.create_user('carla@x.dev', 'carla') as carla \gset

create function tests.notes(who uuid, kind text) returns int language sql security definer set search_path = '' as $$
  select count(*)::int from public.notifications where recipient_id = who and type::text = kind
$$;
grant execute on function tests.notes(uuid, text) to authenticated;

-- Seguir.
select tests.login_as(:'bruno');
insert into follows (followee_id) values (:'ana');
select is(tests.notes(:'ana', 'follow'), 1, 'follow notifies followee');
select is((select actor_id from notifications where recipient_id = :'ana' and type = 'follow' limit 1), null, 'others cannot read my notifications');
delete from follows where followee_id = :'ana';
select is(tests.notes(:'ana', 'follow'), 0, 'unfollow removes unread follow notification');

-- Curtida, inclusive a própria.
select tests.login_as(:'ana');
insert into projects (title) values ('Projeto da Ana') returning id as proj \gset
insert into likes (project_id) values (:'proj');
select is(tests.notes(:'ana', 'like'), 0, 'no notification for own action');
select tests.login_as(:'bruno');
insert into likes (project_id) values (:'proj');
select is(tests.notes(:'ana', 'like'), 1, 'like notifies project author');
delete from likes where project_id = :'proj' and profile_id = :'bruno';
select is(tests.notes(:'ana', 'like'), 0, 'unlike removes unread like notification');

-- Comentário e resposta a comentário.
insert into comments (target_type, target_id, body_md) values ('project', :'proj', 'Legal!') returning id as c1 \gset
select is(tests.notes(:'ana', 'comment'), 1, 'comment notifies target author');
select tests.login_as(:'carla');
insert into comments (target_type, target_id, parent_id, body_md) values ('project', :'proj', :'c1', 'Concordo');
select is(tests.notes(:'bruno', 'reply'), 1, 'reply notifies parent comment author');

-- Pergunta: resposta, voto, aceitar, pedir detalhes.
select tests.login_as(:'ana');
insert into questions (title, body_md) values ('Pergunta sobre Postgres', 'corpo') returning id as q \gset
select tests.login_as(:'bruno');
insert into answers (question_id, body_md) values (:'q', 'resposta') returning id as a \gset
select is(tests.notes(:'ana', 'answer'), 1, 'answer notifies question author');
insert into detail_requests (question_id) values (:'q');
select is(tests.notes(:'ana', 'detail_request'), 1, 'detail request notifies question author');
select tests.login_as(:'carla');
insert into answer_votes (answer_id, value) values (:'a', 1);
select is(tests.notes(:'bruno', 'vote'), 1, 'upvote notifies answer author');
update answer_votes set value = -1 where answer_id = :'a';
select is(tests.notes(:'bruno', 'vote'), 0, 'changing to downvote removes vote notification');
select tests.login_as(:'ana');
update questions set accepted_answer_id = :'a' where id = :'q';
select is(tests.notes(:'bruno', 'accepted'), 1, 'accepting notifies answer author');

-- Marcar como lida.
select tests.login_as(:'bruno');
update notifications set read_at = now() where recipient_id = auth.uid();
select ok((select bool_and(read_at is not null) from notifications where recipient_id = auth.uid()), 'recipient marks read');
select throws_ok($$ update notifications set type = 'like' where recipient_id = auth.uid() $$, '42501', null, 'recipient cannot change type');

-- Apagar a pergunta leva as notificações da pergunta e das respostas.
select tests.login_as(:'ana');
delete from questions where id = :'q';
reset role;
select is((select count(*)::int from notifications where target_id in (:'q', :'a')), 0, 'deleting question removes related notifications');

select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'),
  'notifications table in supabase_realtime publication');

select * from finish();
rollback;
