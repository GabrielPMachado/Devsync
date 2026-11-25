begin;
\ir ../helpers.psql
select plan(39);

-- Catálogo animado: banners, cores e bordas novas por conquista e 15 insígnias novas.

select tests.create_user('lia@x.dev', 'lia') as lia \gset
select tests.create_user('rui@x.dev', 'rui') as rui \gset

create function tests.has_badge(who uuid, key text) returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from public.user_badges where profile_id = who and badge = key)
$$;
create function tests.give(who uuid, key text) returns void language sql security definer set search_path = '' as $$
  insert into public.user_badges (profile_id, badge) values (who, key) on conflict do nothing
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Catálogo ---------------------------------------------------------------------
select is(cardinality(public.badge_keys()), 30, '30 insígnias');
select is(public.banner_required_badge('hiperespaco'), 'icon', 'hiperespaço vem com Ícone');
select is(public.banner_required_badge('aurora'), null, 'banner antigo segue livre');
select is(public.accent_required_badge('retro'), 'founder', 'retrô vem com Membro fundador');
select is(public.accent_required_badge('azul'), null, 'cor antiga segue livre');
select is(public.frame_required_badge('lendaria'), 'legend', 'lendária vem com Lenda');
select is(public.frame_required_badge('neon'), 'mentor', 'bordas antigas não mudaram');

-- Travas: banner, cor e borda novas exigem a insígnia ---------------------------
select tests.login_as(:'lia');
select throws_ok($$ update profiles set banner_preset = 'mosaico' where id = auth.uid() $$, 'DS005', null, 'banner novo bloqueado sem Conectado');
select throws_ok($$ update profiles set accent = 'mar' where id = auth.uid() $$, 'DS005', null, 'cor nova bloqueada sem Primeiro fã');
select throws_ok($$ update profiles set avatar_frame = 'cometa' where id = auth.uid() $$, 'DS005', null, 'borda nova bloqueada sem Primeiro fã');
select lives_ok($$ update profiles set banner_preset = 'nebulosa', accent = 'turquesa' where id = auth.uid() $$, 'banner e cor livres continuam valendo');
select throws_ok($$ update profiles set banner_preset = 'arcoiris' where id = auth.uid() $$, '23514', null, 'banner fora da lista falha');
select throws_ok($$ update profiles set accent = 'preto' where id = auth.uid() $$, '23514', null, 'cor fora da lista falha');
select tests.give(:'lia', 'connected');
select tests.give(:'lia', 'first_follower');
select lives_ok($$ update profiles set banner_preset = 'mosaico', accent = 'mar', avatar_frame = 'cometa' where id = auth.uid() $$, 'com as insígnias, libera');
select lives_ok($$ update profiles set display_name = 'Lia' where id = auth.uid() $$, 'mexer em outra coisa não confere de novo');
reset role;

-- Projetos: prolífico (30), estrela (100 curtidas), ao vivo (demo no ar) ------
insert into public.projects (author_id, title) select :'lia', 'Projeto ' || g from generate_series(1, 29) g;
select ok(not tests.has_badge(:'lia', 'prolific'), '29 projetos ainda não');
insert into public.projects (author_id, title) values (:'lia', 'Projeto 30') returning id as p30 \gset
select ok(tests.has_badge(:'lia', 'prolific'), '30 projetos dão prolífico');

update public.projects set likes_count = 99 where id = :'p30';
select ok(not tests.has_badge(:'lia', 'star'), '99 curtidas ainda não');
update public.projects set likes_count = 100 where id = :'p30';
select ok(tests.has_badge(:'lia', 'star'), '100 curtidas dão estrela');

insert into public.demos (owner_id, kind, url) values (:'lia', 'web_link', 'https://exemplo.dev') returning id as demo \gset
select ok(not tests.has_badge(:'lia', 'demo_live'), 'demo pendente ainda não');
update public.demos set status = 'live' where id = :'demo';
select ok(tests.has_badge(:'lia', 'demo_live'), 'demo no ar dá ao vivo');

-- Curtidas dadas: apoiador (25) e fã (100); curtir o próprio não conta ---------
insert into public.likes (profile_id, project_id)
select :'rui', id from public.projects where author_id = :'lia' and id <> :'p30' limit 24;
select ok(not tests.has_badge(:'rui', 'supporter'), '24 curtidas ainda não');
insert into public.projects (author_id, title) values (:'rui', 'Meu projeto') returning id as mine \gset
insert into public.likes (profile_id, project_id) values (:'rui', :'mine');
select ok(not tests.has_badge(:'rui', 'supporter'), 'curtir o próprio projeto não conta');
insert into public.likes (profile_id, project_id) values (:'rui', :'p30');
select ok(tests.has_badge(:'rui', 'supporter'), '25 projetos de outras pessoas dão apoiador');
select ok(not tests.has_badge(:'rui', 'fan'), 'fã só com 100');

-- Perguntas: pesquisador (50) ---------------------------------------------------
insert into public.questions (author_id, title, body_md)
select :'rui', 'Pergunta número ' || g, 'corpo da pergunta com texto suficiente' from generate_series(1, 49) g;
select ok(not tests.has_badge(:'rui', 'researcher'), '49 perguntas ainda não');
insert into public.questions (author_id, title, body_md) values (:'rui', 'Pergunta número 50', 'corpo da pergunta com texto suficiente') returning id as q \gset
select ok(tests.has_badge(:'rui', 'researcher'), '50 perguntas dão pesquisador');

-- Respostas: incansável (100), bem votado (10), referência (50) ----------------
insert into public.answers (author_id, question_id, body_md)
select :'lia', :'q', 'resposta com texto suficiente ' || g from generate_series(1, 99) g;
select ok(not tests.has_badge(:'lia', 'tireless'), '99 respostas ainda não');
insert into public.answers (author_id, question_id, body_md) values (:'lia', :'q', 'resposta 100 com texto suficiente') returning id as a100 \gset
select ok(tests.has_badge(:'lia', 'tireless'), '100 respostas dão incansável');

update public.answers set score = 9 where id = :'a100';
select ok(not tests.has_badge(:'lia', 'well_voted'), 'saldo 9 ainda não');
update public.answers set score = 10 where id = :'a100';
select ok(tests.has_badge(:'lia', 'well_voted'), 'saldo 10 dá bem votado');
update public.answers set score = 50 where id = :'a100';
select ok(tests.has_badge(:'lia', 'reference'), 'saldo 50 dá referência');

-- Votos dados: avaliador (50 respostas de outras pessoas) -----------------------
insert into public.answer_votes (profile_id, answer_id, value)
select :'rui', id, 1 from public.answers where author_id = :'lia' and id <> :'a100' limit 49;
select ok(not tests.has_badge(:'rui', 'reviewer'), '49 votos ainda não');
insert into public.answer_votes (profile_id, answer_id, value) values (:'rui', :'a100', 1);
select ok(tests.has_badge(:'rui', 'reviewer'), '50 votos dão avaliador');

-- Comentários: debatedor (100) -------------------------------------------------
insert into public.comments (author_id, target_type, target_id, body_md)
select :'rui', 'project', :'p30', 'comentário ' || g from generate_series(1, 99) g;
select ok(not tests.has_badge(:'rui', 'debater'), '99 comentários ainda não');
insert into public.comments (author_id, target_type, target_id, body_md) values (:'rui', 'project', :'p30', 'comentário 100');
select ok(tests.has_badge(:'rui', 'debater'), '100 comentários dão debatedor');

-- Seguidores e seguindo: primeiro fã, ícone (1.000), conectado (10) -------------
insert into public.follows (follower_id, followee_id) values (:'lia', :'rui');
select ok(tests.has_badge(:'rui', 'first_follower'), 'o primeiro seguidor dá primeiro fã');
update public.profiles set followers_count = 1000 where id = :'rui';
select ok(tests.has_badge(:'rui', 'icon'), '1.000 seguidores dão ícone');
update public.profiles set following_count = 10 where id = :'rui';
select ok(tests.has_badge(:'rui', 'connected'), 'seguir 10 pessoas dá conectado');

select * from finish();
rollback;
