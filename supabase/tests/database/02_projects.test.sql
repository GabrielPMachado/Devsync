begin;
\ir ../helpers.psql
select plan(27);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select tests.create_user('caio@x.dev', 'caio', false) as caio \gset
select tests.create_user('dora@x.dev', 'dora') as dora \gset
reset role;
insert into tags (slug, name) values ('t1','T1'),('t2','T2'),('t3','T3'),('t4','T4'),('t5','T5'),('t6','T6');

-- Demos -----------------------------------------------------------------------
select tests.login_as(:'ana');
select throws_ok($$ insert into demos (kind, url) values ('web_link', 'http://inseguro.dev') $$, '23514', null, 'demo url must be https');
insert into demos (kind, url) values ('web_link', 'https://ana.dev') returning id as link_demo \gset
select is((select status::text from demos where id = :'link_demo'), 'pending', 'demo nasce pending');
select is((select owner_id from demos where id = :'link_demo'), :'ana'::uuid, 'owner vem do login');
select throws_ok(format($$ update demos set status = 'live' where id = %L $$, :'link_demo'), '42501', null, 'user cannot set demo status');

-- O serviço de demos (service_role) publica; trocar a URL volta para pending.
reset role;
update demos set status = 'live', embeddable = true where id = :'link_demo';
select tests.login_as(:'ana');
update demos set url = 'https://ana.dev/v2' where id = :'link_demo';
select is((select status::text from demos where id = :'link_demo'), 'pending', 'changing demo url resets status');

-- Limite de 5 envios de zip por dia e e-mail confirmado.
insert into demos (kind) select 'web_upload' from generate_series(1, 5);
select throws_ok($$ insert into demos (kind) values ('web_upload') $$, 'DS001', null, 'sixth web_upload demo in 24h fails');
select tests.login_as(:'caio');
select throws_ok($$ insert into demos (kind) values ('web_upload') $$, 'DS002', null, 'unconfirmed email cannot create web_upload demo');

-- Visibilidade: pending só para o dono, live e unavailable para todos.
select tests.login_as(:'bruno');
select is((select count(*)::int from demos where id = :'link_demo'), 0, 'pending demo invisible to others');
reset role;
update demos set status = 'live' where id = :'link_demo';
select tests.as_anon();
select is((select count(*)::int from demos where id = :'link_demo'), 1, 'live demo visible to visitors');
reset role;
update demos set status = 'unavailable' where id = :'link_demo';
select tests.as_anon();
select is((select count(*)::int from demos where id = :'link_demo'), 1, 'unavailable demo stays visible (site mostra aviso)');
reset role;
update demos set status = 'blocked' where id = :'link_demo';
select tests.as_anon();
select is((select count(*)::int from demos where id = :'link_demo'), 0, 'blocked demo invisible');

-- Demo bloqueada pela moderação continua bloqueada se o dono trocar a URL.
select tests.login_as(:'ana');
update demos set url = 'https://ana.dev/outra' where id = :'link_demo';
reset role;
select is((select status::text from demos where id = :'link_demo'), 'blocked', 'blocked demo stays blocked after url change');
select tests.login_as(:'bruno');
select throws_ok($$ insert into demos (kind, url) values ('web_upload', 'https://x.dev') $$, '23514', null, 'web_upload demo has no url');

-- Apagar demos não zera o limite diário.
select tests.login_as(:'ana');
delete from demos where kind = 'web_upload';
select throws_ok($$ insert into demos (kind) values ('web_upload') $$, 'DS001', null, 'deleting demos does not reset daily limit');

-- Projetos --------------------------------------------------------------------
select tests.login_as(:'ana');
insert into projects (title, description_md, demo_id) values ('Meu App de Tarefas!', 'Um app', :'link_demo') returning id as proj, slug as proj_slug \gset
select matches(:'proj_slug'::text, '^meu-app-de-tarefas-[a-z0-9]{6}$', 'project slug generated');
select throws_ok(format($$ update projects set slug = 'outro' where id = %L $$, :'proj'), '42501', null, 'project slug immutable');
select throws_ok(format($$ update projects set likes_count = 50 where id = %L $$, :'proj'), '42501', null, 'user cannot write likes_count');
select throws_ok($$ insert into projects (title, repo_url) values ('Projeto', 'ftp://x') $$, '23514', null, 'repo_url must be https');

select tests.login_as(:'bruno');
select throws_ok(format($$ insert into projects (title, demo_id) values ('Roubando demo', %L) $$, :'link_demo'), '42501', null, 'project cannot use someone else''s demo');

-- Tags do projeto: máximo 5, só o autor marca.
select throws_ok(format($$ insert into project_tags (project_id, tag_id) select %L, id from tags where slug = 't1' $$, :'proj'), '42501', null, 'só o autor marca tags');
select tests.login_as(:'ana');
insert into project_tags (project_id, tag_id) select :'proj', id from tags where slug in ('t1','t2','t3','t4','t5');
select throws_ok(format($$ insert into project_tags (project_id, tag_id) select %L, id from tags where slug = 't6' $$, :'proj'), 'DS003', null, 'sixth project tag fails');

-- Curtidas.
select tests.login_as(:'bruno');
insert into likes (project_id) values (:'proj');
select is((select likes_count from projects where id = :'proj'), 1, 'like updates likes_count');
delete from likes where project_id = :'proj';
select is((select likes_count from projects where id = :'proj'), 0, 'unlike reverts likes_count');

-- Projeto oculto pela moderação.
reset role;
update projects set hidden_at = now() where id = :'proj';
select tests.login_as(:'bruno');
select is((select count(*)::int from projects where id = :'proj'), 0, 'hidden project invisible to others');
select tests.login_as(:'ana');
select is((select count(*)::int from projects where id = :'proj'), 1, 'hidden project visible to author');

-- Suspensão.
reset role;
update profiles set suspended_at = now() where id = :'dora';
select tests.login_as(:'dora');
select throws_ok($$ insert into projects (title) values ('Spam spam') $$, '42501', null, 'suspended user cannot insert project');
select throws_ok($$ insert into demos (kind, url) values ('web_link', 'https://spam.dev') $$, '42501', null, 'suspended user cannot insert demo');

select * from finish();
rollback;
