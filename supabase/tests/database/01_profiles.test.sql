begin;
\ir ../helpers.sql
select plan(23);

-- Perfil automático a partir do login (GitHub manda name e avatar_url).
select tests.create_user('ana@x.dev') as ana \gset
select tests.create_user('bruno@x.dev') as bruno \gset
select tests.create_user('carla@x.dev') as carla \gset

select is((select display_name from profiles where id = :'ana'), 'ana', 'new auth user gets profile com display_name do GitHub');
select is((select username from profiles where id = :'ana'), null, '@usuário começa vazio (escolhido no primeiro acesso)');
select is((select locale from profiles where id = :'ana'), 'pt-BR', 'locale padrão pt-BR');

-- Formato e unicidade do @usuário.
select tests.login_as(:'ana');
select throws_ok($$ update profiles set username = 'Ab' where id = auth.uid() $$, '23514', null, 'username curto ou com maiúscula falha');
select throws_ok($$ update profiles set username = 'admin' where id = auth.uid() $$, '23514', null, 'username reservado falha');
select lives_ok($$ update profiles set username = 'ana_dev' where id = auth.uid() $$, 'username válido passa');
select tests.login_as(:'bruno');
select throws_ok($$ update profiles set username = 'ANA_DEV' where id = auth.uid() $$, '23514', null, 'maiúsculas não são aceitas');
select throws_ok($$ update profiles set username = 'ana_dev' where id = auth.uid() $$, '23505', null, 'username unique');

-- Colunas protegidas e perfis alheios.
select throws_ok($$ update profiles set role = 'admin' where id = auth.uid() $$, '42501', null, 'user cannot update role');
select throws_ok($$ update profiles set followers_count = 99 where id = auth.uid() $$, '42501', null, 'user cannot update counters');
select throws_ok($$ update profiles set suspended_at = null where id = auth.uid() $$, '42501', null, 'user cannot update suspended_at');
update profiles set bio = 'hackeado' where id = :'ana';
select tests.login_as(:'ana');
select is((select bio from profiles where id = auth.uid()), null, 'user cannot update other profile');

-- Seguir.
select lives_ok(format($$ insert into follows (follower_id, followee_id) values (%L, %L) $$, :'ana', :'bruno'), 'ana segue bruno');
select is((select followers_count from profiles where id = :'bruno'), 1, 'follow updates followers_count');
select is((select following_count from profiles where id = :'ana'), 1, 'follow updates following_count');
select throws_ok(format($$ insert into follows (follower_id, followee_id) values (%L, %L) $$, :'bruno', :'carla'), '42501', null, 'não dá para seguir em nome de outra pessoa');
delete from follows where follower_id = :'ana' and followee_id = :'bruno';
select is((select followers_count from profiles where id = :'bruno'), 0, 'unfollow updates counters');
select throws_ok(format($$ insert into follows (follower_id, followee_id) values (%L, %L) $$, :'ana', :'ana'), '23514', null, 'cannot follow self');

-- Usuário suspenso não segue ninguém.
reset role;
update profiles set suspended_at = now() where id = :'carla';
select tests.login_as(:'carla');
select throws_ok(format($$ insert into follows (follower_id, followee_id) values (%L, %L) $$, :'carla', :'ana'), '42501', null, 'suspended user cannot follow');

-- Tags.
select tests.login_as(:'ana');
select throws_ok($$ insert into tags (slug, name) values ('C#', 'C#') $$, '23514', null, 'tag slug format: maiúscula falha');
select lives_ok($$ insert into tags (slug, name) values ('c#', 'C#') $$, 'tag slug format: c# passa');
delete from tags where slug = 'c#';
select is((select count(*)::int from tags where slug = 'c#'), 1, 'user cannot delete tag');

-- Visitante lê perfis.
select tests.as_anon();
select ok((select count(*) from profiles) >= 3, 'anon can read profiles');

select * from finish();
rollback;
