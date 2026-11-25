begin;
\ir ../helpers.psql
select plan(22);

-- Catálogo maior do perfil: banners, cores, bordas e insígnias novas.

select tests.create_user('eva@x.dev', 'eva') as eva \gset
select tests.create_user('caio@x.dev', 'caio') as caio \gset

create function tests.has_badge(who uuid, key text) returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from public.user_badges where profile_id = who and badge = key)
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Banners e cores novos -------------------------------------------------------
select tests.login_as(:'eva');
select lives_ok($$ update profiles set banner_preset = 'nebulosa', accent = 'turquesa' where id = auth.uid() $$, 'banner e cor novos valem');
select lives_ok($$ update profiles set banner_preset = 'aurora', accent = 'azul' where id = auth.uid() $$, 'os antigos continuam valendo');
select throws_ok($$ update profiles set banner_preset = 'arcoiris' where id = auth.uid() $$, '23514', null, 'banner fora da lista falha');
select throws_ok($$ update profiles set accent = 'preto' where id = auth.uid() $$, '23514', null, 'cor fora da lista falha');
select lives_ok($$ update profiles set avatar_frame = 'crepusculo' where id = auth.uid() $$, 'borda livre nova vale para todos');
select throws_ok($$ update profiles set avatar_frame = 'prisma' where id = auth.uid() $$, 'DS005', null, 'borda prisma exige Influente');
reset role;

-- Catálogo de insígnias --------------------------------------------------------
select is(cardinality(public.badge_keys()), 30, '30 insígnias no catálogo (a v3 dobrou)');
select is(public.frame_required_badge('orbita'), 'first_project', 'órbita vem com o primeiro projeto');

-- Projetos: arquiteto (15) e querido (25 curtidas) ----------------------------
insert into public.projects (author_id, title) select :'eva', 'Projeto ' || g from generate_series(1, 14) g;
select ok(not tests.has_badge(:'eva', 'architect'), '14 projetos ainda não dão arquiteto');
insert into public.projects (author_id, title) values (:'eva', 'Projeto 15') returning id as p15 \gset
select ok(tests.has_badge(:'eva', 'architect'), '15 projetos dão arquiteto');

update public.projects set likes_count = 24 where id = :'p15';
select ok(not tests.has_badge(:'eva', 'loved'), '24 curtidas ainda não');
update public.projects set likes_count = 25 where id = :'p15';
select ok(tests.has_badge(:'eva', 'loved'), '25 curtidas num projeto dão projeto querido a quem publicou');

-- Perguntas: investigador (10) --------------------------------------------------
insert into public.questions (author_id, title, body_md)
select :'caio', 'Pergunta número ' || g, 'corpo da pergunta com texto suficiente' from generate_series(1, 9) g;
select ok(not tests.has_badge(:'caio', 'investigator'), '9 perguntas ainda não');
insert into public.questions (author_id, title, body_md) values (:'caio', 'Pergunta número 10', 'corpo da pergunta com texto suficiente') returning id as q \gset
select ok(tests.has_badge(:'caio', 'investigator'), '10 perguntas dão investigador');

-- Respostas: primeira e colaborador (25) ---------------------------------------
select ok(not tests.has_badge(:'eva', 'first_answer'), 'sem resposta, sem insígnia');
insert into public.answers (author_id, question_id, body_md) values (:'eva', :'q', 'resposta com texto suficiente');
select ok(tests.has_badge(:'eva', 'first_answer'), 'primeira resposta dá prestativo');
insert into public.answers (author_id, question_id, body_md)
select :'eva', :'q', 'resposta com texto suficiente ' || g from generate_series(2, 24) g;
select ok(not tests.has_badge(:'eva', 'helper'), '24 respostas ainda não');
insert into public.answers (author_id, question_id, body_md) values (:'eva', :'q', 'resposta com texto suficiente 25');
select ok(tests.has_badge(:'eva', 'helper'), '25 respostas dão colaborador');

-- Comentários: conversador (20) ------------------------------------------------
insert into public.comments (author_id, target_type, target_id, body_md)
select :'caio', 'project', :'p15', 'comentário ' || g from generate_series(1, 19) g;
select ok(not tests.has_badge(:'caio', 'commenter'), '19 comentários ainda não');
insert into public.comments (author_id, target_type, target_id, body_md) values (:'caio', 'project', :'p15', 'comentário 20');
select ok(tests.has_badge(:'caio', 'commenter'), '20 comentários dão conversador');

-- Seguidores: influente (250) ---------------------------------------------------
update public.profiles set followers_count = 249 where id = :'caio';
select ok(not tests.has_badge(:'caio', 'influencer'), '249 seguidores ainda não');
update public.profiles set followers_count = 250 where id = :'caio';
select ok(tests.has_badge(:'caio', 'influencer'), '250 seguidores dão influente');

select * from finish();
rollback;
