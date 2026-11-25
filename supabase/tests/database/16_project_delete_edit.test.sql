begin;
\ir ../helpers.psql
select plan(20);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
reset role;
insert into tags (slug, name) values ('t1','T1'),('t2','T2'),('t3','T3'),('t4','T4'),('t5','T5'),('t6','T6');

-- Projeto da Ana com demo enviada (zip), tags, curtida e comentário do Bruno.
select tests.login_as(:'ana');
insert into demos (kind) values ('web_upload') returning id as zip_demo \gset
reset role;
update demos set status = 'live', storage_prefix = 'demos/' || id || '/1/' where id = :'zip_demo';
select tests.login_as(:'ana');
insert into projects (title, demo_id) values ('App da Ana', :'zip_demo') returning id as p1, slug as p1_slug \gset
insert into project_tags (project_id, tag_id) select :'p1', id from tags where slug in ('t1', 't2');

-- Editar tags num passo só ---------------------------------------------------
select lives_ok(format($$ select set_project_tags(%L, array['t2', 't3', 't4']) $$, :'p1'), 'autor troca as tags');
select is((select array_agg(t.slug order by t.slug) from project_tags pt join tags t on t.id = pt.tag_id where pt.project_id = :'p1'),
  array['t2', 't3', 't4']::text[], 'tags ficam exatamente as escolhidas');
select throws_ok(format($$ select set_project_tags(%L, array['t1','t2','t3','t4','t5','t6']) $$, :'p1'), 'DS003', null, 'mais de 5 tags é recusado');
select throws_ok(format($$ select set_project_tags(%L, array['nao-existe']) $$, :'p1'), '22023', null, 'tag inexistente é recusada');
select throws_ok(format($$ select set_project_tags(%L, array[]::text[]) $$, :'p1'), '22023', null, 'projeto precisa de ao menos 1 tag');
select is((select count(*)::int from project_tags where project_id = :'p1'), 3, 'recusa não mexe nas tags');

select tests.login_as(:'bruno');
select throws_ok(format($$ select set_project_tags(%L, array['t1']) $$, :'p1'), '42501', null, 'outra pessoa não troca as tags');
select tests.as_anon();
select throws_ok(format($$ select set_project_tags(%L, array['t1']) $$, :'p1'), '42501', null, 'visitante não chama set_project_tags');

-- Editar o projeto: só o autor, e o endereço (slug) não muda --------------------
select tests.login_as(:'bruno');
update projects set title = 'Roubado' where id = :'p1';
select tests.login_as(:'ana');
select is((select title from projects where id = :'p1'), 'App da Ana', 'outra pessoa não edita o projeto');
update projects set title = 'App da Ana v2', description_md = 'nova', repo_url = 'https://github.com/ana/app' where id = :'p1';
select is((select title || '|' || slug from projects where id = :'p1'), 'App da Ana v2|' || :'p1_slug', 'autor edita e o slug continua o mesmo');

-- Excluir --------------------------------------------------------------------
select tests.login_as(:'bruno');
insert into likes (project_id) values (:'p1');
insert into comments (target_type, target_id, body_md) values ('project', :'p1', 'Muito bom!');
select tests.login_as(:'bruno');
delete from projects where id = :'p1';
select tests.login_as(:'ana');
select is((select count(*)::int from projects where id = :'p1'), 1, 'outra pessoa não exclui o projeto');

reset role;
select ok((select count(*) from notifications where target_id = :'p1' or target_id in (select id from comments where target_id = :'p1')) > 0,
  'antes de excluir há notificações do projeto');
select tests.login_as(:'ana');
delete from projects where id = :'p1';
reset role;
select is((select count(*)::int from projects where id = :'p1'), 0, 'autor exclui o projeto');
select is((select count(*)::int from demos where id = :'zip_demo'), 0, 'a demo do projeto é apagada junto');
select is((select array_agg(demo_id) from private.demo_deletions), array[:'zip_demo'::uuid], 'a demo vai para a fila de limpeza do R2');
select is((select count(*)::int from comments where target_id = :'p1'), 0, 'comentários apagados');
select is((select count(*)::int from notifications where target_type = 'project' and target_id = :'p1'), 0, 'notificações do projeto apagadas');

-- Fila de limpeza: só o serviço de demos (service_role) lê e baixa ---------------
select tests.login_as(:'ana');
select throws_ok($$ select * from pending_demo_deletions(10) $$, '42501', null, 'usuário não lê a fila de limpeza');
reset role;
set local role service_role;
select is((select array_agg(d) from pending_demo_deletions(10) d), array[:'zip_demo'::uuid], 'serviço lê a fila');
select finish_demo_deletions(array[:'zip_demo'::uuid]);
reset role;
select is((select count(*)::int from private.demo_deletions), 0, 'concluir tira da fila');

select * from finish();
rollback;
