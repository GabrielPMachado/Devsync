begin;
\ir ../helpers.psql
select plan(29);

-- Insígnias conquistadas (parte 2 do perfil personalizado).
-- Gravadas por gatilhos na hora da conquista; ninguém escreve pela API.

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select tests.create_user('semnome@x.dev') as semnome \gset

create function tests.badges(who uuid) returns text[] language sql security definer set search_path = '' as $$
  select coalesce(array_agg(badge order by badge), '{}') from public.user_badges where profile_id = who
$$;
create function tests.badge_notifications(who uuid) returns text[] language sql security definer set search_path = '' as $$
  select coalesce(array_agg(badge order by badge), '{}') from public.notifications where recipient_id = who and type = 'badge'
$$;
create function tests.mkq(author uuid, title text) returns uuid language sql as $$
  insert into public.questions (author_id, title, body_md) values (author, title, 'corpo da pergunta com texto suficiente') returning id
$$;
create function tests.mka(author uuid, question uuid) returns uuid language sql as $$
  insert into public.answers (author_id, question_id, body_md) values (author, question, 'resposta com texto suficiente') returning id
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Fundador --------------------------------------------------------------------
select is(tests.badges(:'ana'), array['founder'], 'quem escolhe o @ entre os 1.000 primeiros vira fundador');
select is(tests.badges(:'semnome'), '{}'::text[], 'sem @, ainda não é fundador');
select is(tests.badge_notifications(:'ana'), array['founder'], 'a conquista gera notificação com a insígnia');

-- Simula 1.000 vagas usadas: quem chega depois não ganha, mesmo se um fundador sair.
update private.founder_slots set used = 1000;
delete from auth.users where id = :'bruno';
select tests.create_user('bruno2@x.dev', 'bruno') as bruno \gset
select is(tests.badges(:'bruno'), '{}'::text[], 'depois de 1.000 fundadores, ninguém mais ganha (vaga de quem saiu não volta)');
update private.founder_slots set used = 999;
update public.profiles set username = 'carla' where id = :'semnome';
select is(tests.badges(:'semnome'), array['founder'], 'a milésima vaga ainda vale');
update public.profiles set username = 'dora' where id = (select tests.create_user('dora@x.dev'));
select is((select used from private.founder_slots), 1000, 'o contador para em 1.000');

-- Projetos --------------------------------------------------------------------
insert into public.projects (author_id, title) values (:'ana', 'Proj 1');
select is(tests.badges(:'ana'), array['first_project', 'founder'], 'primeiro projeto dá first_project');
insert into public.projects (author_id, title) select :'ana', 'Proj ' || g from generate_series(2, 4) g;
select ok(not ('builder' = any (tests.badges(:'ana'))), '4 projetos ainda não dão builder');
insert into public.projects (author_id, title) values (:'ana', 'Proj 5');
select ok('builder' = any (tests.badges(:'ana')), '5 projetos dão builder');
delete from public.projects where author_id = :'ana';
select ok('builder' = any (tests.badges(:'ana')), 'apagar os projetos não tira a insígnia');

-- Perguntas e respostas aceitas -----------------------------------------------
select tests.mkq(:'bruno', 'Pergunta do Bruno') as q1 \gset
select ok('curious' = any (tests.badges(:'bruno')), 'primeira pergunta dá curious');

select tests.mka(:'bruno', :'q1') as self_answer \gset
update public.questions set accepted_answer_id = :'self_answer' where id = :'q1';
select ok(not ('first_accepted' = any (tests.badges(:'bruno'))), 'aceitar a própria resposta não conta');

select tests.mka(:'ana', :'q1') as a1 \gset
update public.questions set accepted_answer_id = :'a1' where id = :'q1';
select ok('first_accepted' = any (tests.badges(:'ana')), 'resposta aceita por outra pessoa dá first_accepted');

-- Mentor: 10 respostas aceitas em perguntas de outras pessoas.
do $$
declare
  ana uuid := (select id from public.profiles where username = 'ana');
  bruno uuid := (select id from public.profiles where username = 'bruno');
  q uuid; a uuid;
begin
  for i in 1..8 loop
    insert into public.questions (author_id, title, body_md) values (bruno, 'Outra pergunta ' || i, 'corpo da pergunta com texto suficiente') returning id into q;
    insert into public.answers (author_id, question_id, body_md) values (ana, q, 'resposta com texto suficiente') returning id into a;
    update public.questions set accepted_answer_id = a where id = q;
  end loop;
end $$;
select ok(not ('mentor' = any (tests.badges(:'ana'))), '9 aceitas ainda não dão mentor');
select tests.mkq(:'bruno', 'Décima pergunta') as q10 \gset
select tests.mka(:'ana', :'q10') as a10 \gset
update public.questions set accepted_answer_id = :'a10' where id = :'q10';
select ok('mentor' = any (tests.badges(:'ana')), '10 aceitas dão mentor');

-- Popular ---------------------------------------------------------------------
update public.profiles set followers_count = 49 where id = :'bruno';
select ok(not ('popular' = any (tests.badges(:'bruno'))), '49 seguidores ainda não dão popular');
update public.profiles set followers_count = 50 where id = :'bruno';
select ok('popular' = any (tests.badges(:'bruno')), '50 seguidores dão popular');
update public.profiles set followers_count = 10 where id = :'bruno';
select ok('popular' = any (tests.badges(:'bruno')), 'perder seguidores não tira popular');

-- Insígnia repetida não gera notificação de novo.
select is(tests.badge_notifications(:'bruno'), array['curious', 'first_answer', 'first_follower', 'investigator', 'popular'], 'uma notificação por insígnia, sem repetir');

-- API: leitura pública, escrita proibida ------------------------------------
select tests.as_anon();
select ok((select count(*) from public.user_badges where profile_id = :'ana') > 0, 'visitante lê as insígnias');

select tests.login_as(:'bruno');
select throws_ok($$ insert into public.user_badges (profile_id, badge) values (auth.uid(), 'mentor') $$,
  '42501', null, 'ninguém se dá insígnia pela API');
select throws_ok($$ delete from public.user_badges where profile_id = auth.uid() $$,
  '42501', null, 'ninguém apaga insígnia pela API');

-- Exibir até 3 ---------------------------------------------------------------
select lives_ok($$ update public.profiles set shown_badges = array['popular', 'curious'] where id = auth.uid() $$,
  'exibe insígnias conquistadas');
select throws_ok($$ update public.profiles set shown_badges = array['mentor'] where id = auth.uid() $$,
  'DS004', null, 'não exibe insígnia que não conquistou');
select throws_ok($$ update public.profiles set shown_badges = array['popular', 'popular'] where id = auth.uid() $$,
  'DS004', null, 'não repete insígnia');

select tests.login_as(:'ana');
select throws_ok($$ update public.profiles set shown_badges = array['founder', 'mentor', 'builder', 'first_project'] where id = auth.uid() $$,
  '23514', null, 'no máximo 3 insígnias');

-- Bordas ----------------------------------------------------------------------
select tests.login_as(:'bruno');
select lives_ok($$ update public.profiles set avatar_frame = 'ciano' where id = auth.uid() $$, 'borda livre para todos');
select throws_ok($$ update public.profiles set avatar_frame = 'neon' where id = auth.uid() $$,
  'DS005', null, 'borda neon exige Mentor');
select tests.login_as(:'ana');
select lives_ok($$ update public.profiles set avatar_frame = 'neon' where id = auth.uid() $$, 'Mentor usa a borda neon');

select * from finish();
rollback;
