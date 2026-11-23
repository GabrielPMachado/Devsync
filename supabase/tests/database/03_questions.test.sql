begin;
\ir ../helpers.psql
select plan(26);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select tests.create_user('carla@x.dev', 'carla') as carla \gset
select tests.create_user('dora@x.dev', 'dora') as dora \gset

-- Pergunta da Ana, respostas do Bruno e da Carla.
select tests.login_as(:'ana');
insert into questions (title, body_md) values ('Como usar useEffect no React?', 'Corpo original') returning id as q, slug as q_slug \gset
select matches(:'q_slug'::text, '^como-usar-useeffect-no-react-[a-z0-9]{6}$', 'question slug generated');
select throws_ok($$ insert into questions (title, body_md) values ('Curto', 'x') $$, '23514', null, 'título precisa de 10 caracteres');
select is((select lang from questions where id = :'q'), 'pt-BR', 'lang padrão pt-BR');
select ok(exists (select 1 from questions where id = :'q' and author_id = :'ana'), 'author vem do login');

select tests.login_as(:'bruno');
insert into answers (question_id, body_md, tech_version) values (:'q', 'Resposta do Bruno', 'React 19') returning id as a_bruno \gset
select tests.login_as(:'carla');
insert into answers (question_id, body_md) values (:'q', 'Resposta da Carla') returning id as a_carla \gset
select is((select answers_count from questions where id = :'q'), 2, 'answer insert bumps answers_count');

-- Votos: +1, troca para -1, remove.
select tests.login_as(:'ana');
insert into answer_votes (answer_id, value) values (:'a_bruno', 1);
select is((select score from answers where id = :'a_bruno'), 1, 'vote +1 sets score 1');
update answer_votes set value = -1 where answer_id = :'a_bruno';
select is((select score from answers where id = :'a_bruno'), -1, 'change vote to -1 sets score -1');
delete from answer_votes where answer_id = :'a_bruno';
select is((select score from answers where id = :'a_bruno'), 0, 'deleting vote sets score 0');
select throws_ok(format($$ insert into answer_votes (answer_id, value) values (%L, 2) $$, :'a_bruno'), '23514', null, 'voto só vale +1 ou -1');
select throws_ok(format($$ insert into answer_votes (answer_id, value) values (%L, 1) $$, :'q'), '42501', null, 'voto em resposta inexistente falha');
select tests.login_as(:'bruno');
select throws_ok(format($$ insert into answer_votes (answer_id, value) values (%L, 1) $$, :'a_bruno'), '42501', null, 'cannot vote own answer');
select throws_ok(format($$ update answers set score = 100 where id = %L $$, :'a_bruno'), '42501', null, 'user cannot write score');

-- Aceitar resposta.
update questions set accepted_answer_id = :'a_bruno' where id = :'q';
select is((select accepted_answer_id from questions where id = :'q'), null, 'only question author accepts');
select tests.login_as(:'dora');
insert into questions (title, body_md) values ('Outra pergunta qualquer', 'x') returning id as q2 \gset
select throws_ok(format($$ update questions set accepted_answer_id = %L where id = %L $$, :'a_bruno', :'q2'), '23514', null, 'cannot accept answer from other question');
select tests.login_as(:'ana');
update questions set accepted_answer_id = :'a_bruno' where id = :'q';
select is((select accepted_answer_id from questions where id = :'q'), :'a_bruno'::uuid, 'autor aceita a resposta');

-- "Não funciona mais".
select lives_ok(format($$ insert into outdated_flags (answer_id) values (%L) $$, :'a_bruno'), 'ana marca não funciona mais');
select tests.login_as(:'carla');
insert into outdated_flags (answer_id) values (:'a_bruno');
select is((select outdated_flags from answers where id = :'a_bruno'), 2, 'outdated flag increments');
select throws_ok(format($$ insert into outdated_flags (answer_id) values (%L) $$, :'a_carla'), '42501', null, 'cannot flag own answer');
select tests.login_as(:'bruno');
update answers set body_md = 'Resposta do Bruno, corrigida' where id = :'a_bruno';
select is((select outdated_flags from answers where id = :'a_bruno'), 0, 'editing answer body resets flags to 0');
reset role;
select is((select count(*)::int from outdated_flags where answer_id = :'a_bruno'), 0, 'editing answer body deletes flag rows');
select is((select body_md from revisions where target_type = 'answer' and target_id = :'a_bruno'), 'Resposta do Bruno', 'editing answer stores revision with old body');

-- "Precisa de mais detalhes".
select tests.login_as(:'ana');
select throws_ok(format($$ insert into detail_requests (question_id) values (%L) $$, :'q'), '42501', null, 'detail request on own question fails');
select tests.login_as(:'bruno');
insert into detail_requests (question_id) values (:'q');
select is((select detail_requests_count from questions where id = :'q'), 1, 'detail request bumps counter');

-- Revisão da pergunta.
select tests.login_as(:'ana');
update questions set body_md = 'Corpo editado' where id = :'q';
reset role;
select is((select body_md from revisions where target_type = 'question' and target_id = :'q'), 'Corpo original', 'editing question body creates revision with old body');

-- Pergunta oculta não recebe resposta; suspenso não responde.
update questions set hidden_at = now() where id = :'q2';
select tests.login_as(:'carla');
select throws_ok(format($$ insert into answers (question_id, body_md) values (%L, 'oi') $$, :'q2'), '42501', null, 'cannot answer hidden question');
reset role;
update profiles set suspended_at = now() where id = :'carla';
select tests.login_as(:'carla');
select throws_ok(format($$ insert into answers (question_id, body_md) values (%L, 'oi') $$, :'q'), '42501', null, 'suspended user cannot answer');

select * from finish();
rollback;
