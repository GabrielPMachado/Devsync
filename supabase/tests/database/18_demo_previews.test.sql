begin;
\ir ../helpers.psql
select plan(15);

-- Print automático da demo: o serviço de demos pega a fila e grava o resultado.
select tests.create_user('ana@x.dev', 'ana_pv') as ana \gset
reset role;
insert into tags (slug, name) values ('pv1', 'PV1');

select tests.login_as(:'ana');
insert into demos (kind, url) values ('web_link', 'https://ana.dev') returning id as link_demo \gset
insert into demos (kind) values ('web_upload') returning id as zip_demo \gset
insert into demos (kind, url) values ('web_link', 'https://capa.dev') returning id as cover_demo \gset
insert into demos (kind, url) values ('web_link', 'https://pendente.dev') returning id as pending_demo \gset
reset role;
update demos set status = 'live' where id in (:'link_demo', :'zip_demo', :'cover_demo');
update demos set storage_prefix = 'demos/' || id || '/1/' where id = :'zip_demo';
select tests.login_as(:'ana');
insert into projects (title, demo_id) values ('Link', :'link_demo'), ('Zip', :'zip_demo'), ('Pendente', :'pending_demo');
insert into projects (title, demo_id, cover_url)
  values ('Com capa', :'cover_demo', format('https://x.supabase.co/storage/v1/object/public/project-covers/%s/cover-1.webp', :'ana'));

-- Só o serviço chama as funções.
select throws_ok($$ select * from pending_demo_previews(10) $$, '42501', null, 'usuário não lê a fila de prints');
select throws_ok(format($$ select record_demo_preview(%L, 1, 'https://x/p.jpg') $$, :'link_demo'), '42501', null, 'usuário não grava print');
select throws_ok(format($$ update demos set screenshot_url = 'https://evil/x.jpg' where id = %L $$, :'link_demo'), '42501', null, 'usuário não troca o print direto');
reset role;

set local role service_role;
select is((select array_agg(id order by id) from pending_demo_previews(10)),
  (select array_agg(x order by x) from unnest(array[:'link_demo', :'zip_demo']::uuid[]) x),
  'fila: demos no ar, de projetos sem capa');
select is((select url from pending_demo_previews(10) where id = :'zip_demo'), null, 'demo enviada vem sem url (o serviço monta)');

select lives_ok(format($$ select record_demo_preview(%L, 1, 'https://demos.dev/previews/%s/1.jpg') $$, :'link_demo', :'link_demo'), 'grava o print');
select is((select screenshot_url from demos where id = :'link_demo'), format('https://demos.dev/previews/%s/1.jpg', :'link_demo'), 'print salvo na demo');
select is((select array_agg(id) from pending_demo_previews(10)), array[:'zip_demo']::uuid[], 'demo com print sai da fila');

-- Falhas: espera 1 h entre tentativas; depois de 3, só 1 vez por dia (nunca desiste de vez).
select record_demo_preview(:'zip_demo', 1, null);
select is((select count(*)::int from pending_demo_previews(10)), 0, 'logo depois de falhar, espera');
reset role;
update demos set screenshot_tried_at = now() - interval '61 minutes' where id = :'zip_demo';
set local role service_role;
select is((select count(*)::int from pending_demo_previews(10)), 1, 'depois de 1 h, tenta de novo');
select record_demo_preview(:'zip_demo', 1, null);
select record_demo_preview(:'zip_demo', 1, null);
reset role;
update demos set screenshot_tried_at = now() - interval '2 hours' where id = :'zip_demo';
set local role service_role;
select is((select count(*)::int from pending_demo_previews(10)), 0, 'depois de 3 falhas, espera um dia');
reset role;
update demos set screenshot_tried_at = now() - interval '25 hours' where id = :'zip_demo';
set local role service_role;
select is((select count(*)::int from pending_demo_previews(10)), 1, 'e tenta de novo no dia seguinte');

-- Link trocado: o print antigo some e volta para a fila quando a demo validar.
reset role;
update demos set url = 'https://ana-nova.dev' where id = :'link_demo';
select is((select screenshot_url from demos where id = :'link_demo'), null, 'trocar o link apaga o print antigo');
-- Projeto oculto pela moderação não gasta print.
update demos set status = 'live' where id = :'link_demo';
update projects set hidden_at = now() where demo_id = :'link_demo';
set local role service_role;
select ok(not exists (select 1 from pending_demo_previews(10) where id = :'link_demo'), 'projeto oculto fica fora da fila');
reset role;
update projects set hidden_at = null where demo_id = :'link_demo';
update demos set screenshot_url = 'https://demos.dev/x.jpg' where id = :'link_demo';

-- Apagar demo de link com print manda limpar o R2.
delete from projects where demo_id = :'link_demo';
select ok(exists (select 1 from private.demo_deletions where demo_id = :'link_demo'), 'link com print vai para a limpeza do R2');

select * from finish();
rollback;
