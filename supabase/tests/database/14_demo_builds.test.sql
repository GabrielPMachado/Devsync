begin;
\ir ../helpers.psql
select plan(10);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bia@x.dev', 'bia') as bia \gset

select has_table('public', 'demo_builds', 'demo_builds exists');

select tests.login_as(:'ana');
insert into demos (kind) values ('web_upload') returning id as up \gset

select throws_ok(
  format('insert into demo_builds (demo_id, owner_id, repo, ref) values (%L, %L, %L, %L)', :'up', :'ana', 'ana/app', 'main'),
  '42501', null, 'user cannot create a build');

-- O serviço de demos cria e atualiza.
reset role;
set local role service_role;
insert into demo_builds (demo_id, owner_id, repo, ref) values (:'up', :'ana', 'ana/app', 'main') returning id as build \gset
select throws_ok(
  format('insert into demo_builds (demo_id, owner_id, repo, ref) values (gen_random_uuid(), %L, %L, %L)', :'ana', 'ana/x;rm', 'main'),
  '23514', null, 'repo name is checked');
update demo_builds set stage = 'building' where id = :'build';

reset role;
select tests.login_as(:'ana');
select is((select stage::text from demo_builds where id = :'build'), 'building', 'owner reads the build');
select throws_ok(
  format('update demo_builds set stage = %L where id = %L', 'ready', :'build'),
  '42501', null, 'owner cannot change the build');

select tests.login_as(:'bia');
select is((select count(*)::int from demo_builds), 0, 'others do not see the build');

reset role;
set local role anon;
select throws_ok('select * from demo_builds', '42501', null, 'anon cannot read builds');

-- Validação do zip encerra o build.
reset role;
set local role service_role;
update demos set status = 'live' where id = :'up';
select is((select stage::text from demo_builds where id = :'build'), 'ready', 'live demo -> build ready');

update demo_builds set stage = 'validating' where id = :'build';
update demos set status = 'unavailable', rejection_reason = 'no_index' where id = :'up';
select is((select stage::text || ':' || error from demo_builds where id = :'build'), 'failed:no_index', 'rejected zip -> build failed with the reason');

-- Erro do build já gravado não é trocado pelo motivo genérico.
reset role;
set local role service_role;
insert into demos (owner_id, kind) values (:'ana', 'web_upload') returning id as up2 \gset
insert into demo_builds (demo_id, owner_id, repo, ref, stage, error) values (:'up2', :'ana', 'ana/app', 'main', 'failed', 'install_failed');
update demos set status = 'unavailable', rejection_reason = 'build_failed' where id = :'up2';
select is((select error from demo_builds where demo_id = :'up2'), 'install_failed', 'build error is kept');

select * from finish();
rollback;
