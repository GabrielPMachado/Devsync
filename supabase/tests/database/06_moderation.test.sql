begin;
\ir ../helpers.sql
select plan(15);

select tests.create_user('admin@x.dev', 'gabriel') as adm \gset
select tests.make_admin(:'adm');
select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset

select tests.login_as(:'ana');
insert into questions (title, body_md) values ('Pergunta original da Ana', 'x') returning id as q \gset
insert into questions (title, body_md) values ('Pergunta repetida da Ana', 'x') returning id as q2 \gset
select tests.login_as(:'bruno');
insert into answers (question_id, body_md) values (:'q', 'resposta ruim') returning id as a \gset

-- Denúncias.
select lives_ok(format($$ insert into reports (target_type, target_id, reason) values ('answer', %L, 'ofensivo') $$, :'a'), 'user can report');
select throws_ok(format($$ insert into reports (target_type, target_id, reason) values ('answer', %L, 'de novo') $$, :'a'), '23505', null, 'user can report once per target');
select is((select count(*)::int from reports), 1, 'reporter sees own report');
select tests.login_as(:'ana');
select is((select count(*)::int from reports), 0, 'others do not see reports');
select throws_ok(format($$ insert into reports (target_type, target_id, reason) values ('answer', %L, 'x') $$, gen_random_uuid()), '42501', null, 'cannot report missing content');

-- Ações de admin.
select throws_ok(format($$ select admin_set_hidden('answer', %L, true) $$, :'a'), '42501', null, 'non-admin calling admin_set_hidden fails');
select tests.login_as(:'adm');
select is((select count(*)::int from reports), 1, 'admin sees all reports');
select lives_ok(format($$ select admin_set_hidden('answer', %L, true) $$, :'a'), 'admin hides answer');
select lives_ok(format($$ select admin_resolve_report(id, 'actioned') from reports where target_id = %L $$, :'a'), 'admin resolves report');
select is((select status::text from reports where target_id = :'a'), 'actioned', 'report marked actioned');
select tests.login_as(:'ana');
select is((select count(*)::int from answers where id = :'a'), 0, 'hidden answer disappears for others');

select tests.login_as(:'adm');
select admin_mark_duplicate(:'q2', :'q');
select is((select duplicate_of_id from questions where id = :'q2'), :'q'::uuid, 'admin marks duplicate (veja também)');
select admin_suspend_profile(:'bruno', true);
select tests.login_as(:'bruno');
select throws_ok(format($$ insert into answers (question_id, body_md) values (%L, 'de novo') $$, :'q'), '42501', null, 'admin suspends profile and user can no longer post');

-- Demo suspensa some na hora.
reset role;
insert into demos (owner_id, kind, url, status) values (:'ana', 'web_link', 'https://ana.dev', 'live') returning id as d \gset
select tests.login_as(:'adm');
select admin_set_demo_status(:'d', 'blocked');
select tests.as_anon();
select is((select count(*)::int from demos where id = :'d'), 0, 'blocked demo disappears');
select throws_ok(format($$ select admin_suspend_profile(%L, false) $$, :'bruno'), '42501', null, 'anon cannot call admin functions');

select * from finish();
rollback;
