begin;
\ir ../helpers.psql
select plan(30);

select tests.create_user('admin@x.dev', 'gabriel') as adm \gset
select tests.make_admin(:'adm');
select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select tests.create_user('caio@x.dev', 'caio') as caio \gset

select tests.login_as(:'ana');
insert into questions (title, body_md) values ('Como centralizar uma div?', 'texto da pergunta') returning id as q, slug as qslug \gset
select tests.login_as(:'bruno');
insert into answers (question_id, body_md) values (:'q', 'Pergunta boba, pesquisa no Google') returning id as a \gset
select tests.login_as(:'ana');

-- Duas pessoas denunciam a mesma resposta; uma denuncia o perfil do Bruno.
insert into reports (target_type, target_id, reason) values ('answer', :'a', 'Grosseria ou ofensa');
select tests.login_as(:'caio');
insert into reports (target_type, target_id, reason) values ('answer', :'a', 'Spam: link estranho');
insert into reports (target_type, target_id, reason) values ('profile', :'bruno', 'Outro: perfil falso');

-- Permissão.
select throws_ok($$ select * from admin_report_queue('open') $$, '42501', null, 'non-admin cannot read the queue');
select tests.as_anon();
select throws_ok($$ select * from admin_report_queue('open') $$, '42501', null, 'anon cannot read the queue');

-- Fila agrupada.
select tests.login_as(:'adm');
select is((select count(*)::int from admin_report_queue('open')), 2, 'queue groups reports by target');
select is((select report_count from admin_report_queue('open') where target_id = :'a'), 2, 'answer has 2 reports');
select is((select reasons from admin_report_queue('open') where target_id = :'a'),
  array['Grosseria ou ofensa', 'Spam: link estranho'], 'reasons listed oldest first');
select is((select author_username from admin_report_queue('open') where target_id = :'a'), 'bruno', 'answer author shown');
select is((select preview from admin_report_queue('open') where target_id = :'a'), 'Pergunta boba, pesquisa no Google', 'answer preview is its text');
select is((select path from admin_report_queue('open') where target_id = :'a'),
  '/estudos/' || :'qslug' || '#resposta-' || :'a', 'answer path points to the question');
select is((select hidden from admin_report_queue('open') where target_id = :'a'), false, 'answer not hidden yet');
select is((select path from admin_report_queue('open') where target_type = 'profile'), '/@bruno', 'profile path');
select is((select author_id from admin_report_queue('open') where target_type = 'profile'), :'bruno'::uuid, 'profile author is the profile itself');

-- Resolver por alvo fecha todas as denúncias abertas dele.
select admin_set_hidden('answer', :'a', true);
select lives_ok(format($$ select admin_resolve_target('answer', %L, 'actioned') $$, :'a'), 'admin resolves target');
select is((select count(*)::int from reports where target_id = :'a' and status = 'actioned'), 2, 'both reports actioned');
select is((select resolved_by from reports where target_id = :'a' limit 1), :'adm'::uuid, 'resolved_by is the admin');
select is((select count(*)::int from admin_report_queue('open')), 1, 'answer left the open queue');
select is((select hidden from admin_report_queue('actioned') where target_id = :'a'), true, 'resolved queue shows hidden state');
select throws_ok(format($$ select admin_resolve_target('answer', %L, 'open') $$, :'a'), '22023', null, 'cannot resolve as open');

-- Comentário em projeto e demo: caminhos certos.
reset role;
insert into demos (owner_id, kind, url, status) values (:'ana', 'web_link', 'https://ana.dev', 'live') returning id as d0 \gset
select tests.login_as(:'ana');
insert into projects (title, description_md, demo_id) values ('Projeto da Ana', 'descrição', :'d0') returning id as p, slug as pslug \gset
select tests.login_as(:'bruno');
insert into comments (target_type, target_id, body_md) values ('project', :'p', 'que lixo') returning id as c \gset
select tests.login_as(:'caio');
insert into reports (target_type, target_id, reason) values ('comment', :'c', 'Grosseria ou ofensa');
insert into reports (target_type, target_id, reason) values ('demo', :'d0', 'Golpe ou código malicioso');
select tests.login_as(:'adm');
select is((select path from admin_report_queue('open') where target_id = :'c'), '/projetos/' || :'pslug' || '#comentarios', 'comment path');
select is((select path from admin_report_queue('open') where target_id = :'d0'), '/projetos/' || :'pslug' || '?demo=' || :'d0', 'demo path opens project overlay');
select is((select demo_status::text from admin_report_queue('open') where target_id = :'d0'), 'live', 'demo status shown');

-- Domínios bloqueados.
reset role;
insert into demos (owner_id, kind, url, status) values (:'ana', 'web_link', 'https://app.golpe.dev/x', 'live') returning id as d1 \gset
insert into demos (owner_id, kind, url, status) values (:'ana', 'web_link', 'https://bom.dev', 'live') returning id as d2 \gset
select tests.login_as(:'bruno');
select throws_ok($$ select admin_block_domain('golpe.dev', 'phishing') $$, '42501', null, 'non-admin cannot block domains');
select is((select count(*)::int from blocked_domains), 0, 'non-admin cannot read blocked domains');
select tests.login_as(:'adm');
select lives_ok($$ select admin_block_domain('  WWW.Golpe.dev ', 'phishing') $$, 'admin blocks domain');
select is((select domain from blocked_domains), 'golpe.dev', 'domain normalized');
select is((select status::text from demos where id = :'d1'), 'blocked', 'existing demo on subdomain blocked at once');
select is((select status::text from demos where id = :'d2'), 'live', 'other demos untouched');
select tests.login_as(:'caio');
select throws_ok($$ insert into demos (kind, url) values ('web_link', 'https://golpe.dev/') $$, 'P0001', 'Domínio bloqueado', 'cannot publish demo on blocked domain');
select throws_ok($$ insert into demos (kind, url) values ('web_link', 'https://x.y.golpe.dev:8443/a') $$, 'P0001', 'Domínio bloqueado', 'subdomains with port also blocked');
select lives_ok($$ insert into demos (kind, url) values ('web_link', 'https://naogolpe.dev/') $$, 'similar domain is fine');
select tests.login_as(:'adm');
select admin_unblock_domain('golpe.dev');
select tests.login_as(:'caio');
select lives_ok($$ insert into demos (kind, url) values ('web_link', 'https://golpe.dev/') $$, 'unblocked domain accepted again');

select * from finish();
rollback;
