begin;
\ir ../helpers.psql
select plan(10);

-- Capa do projeto: só imagem da pasta do próprio autor no bucket project-covers.
select tests.create_user('ana@x.dev', 'ana_cv') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno_cv') as bruno \gset

select tests.login_as(:'ana');
insert into demos (kind, url) values ('web_link', 'https://ana.dev') returning id as demo \gset
select lives_ok(format($$ insert into projects (title, demo_id, cover_url)
  values ('Com capa', %L, 'https://abc.supabase.co/storage/v1/object/public/project-covers/%s/cover-1.webp?v=1') $$, :'demo', :'ana'),
  'publica com capa da própria pasta');
select throws_ok($$ insert into projects (title, cover_url) values ('Capa externa', 'https://evil.example/x.png') $$,
  '22023', null, 'capa externa é recusada ao publicar');
select throws_ok(format($$ insert into projects (title, cover_url)
  values ('Capa do outro', 'https://abc.supabase.co/storage/v1/object/public/project-covers/%s/cover-1.webp') $$, :'bruno'),
  '22023', null, 'capa da pasta de outra pessoa é recusada');
select throws_ok(format($$ insert into projects (title, cover_url)
  values ('Outro bucket', 'https://abc.supabase.co/storage/v1/object/public/banners/%s/cover-1.webp') $$, :'ana'),
  '22023', null, 'capa em outro bucket é recusada');
insert into projects (title) values ('Sem capa') returning id as p2 \gset
select is((select cover_url from projects where id = :'p2'), null, 'publica sem capa');

select lives_ok(format($$ update projects set cover_url = 'http://127.0.0.1:54321/storage/v1/object/public/project-covers/%s/cover-2.webp?v=2' where id = %L $$, :'ana', :'p2'),
  'troca a capa por outra da própria pasta');
select throws_ok(format($$ update projects set cover_url = 'https://evil.example/y.png' where id = %L $$, :'p2'),
  '22023', null, 'trocar para capa externa é recusado');
select lives_ok(format($$ update projects set cover_url = null where id = %L $$, :'p2'), 'remove a capa');
reset role;

-- Capa antiga inválida (de antes da regra) é limpa pela migração.
alter table projects disable trigger projects_cover_guard;
update projects set cover_url = 'https://evil.example/old.png' where id = :'p2';
alter table projects enable trigger projects_cover_guard;
select private.clear_invalid_covers();
select is((select cover_url from projects where id = :'p2'), null, 'capa inválida antiga é apagada');

select case when to_regclass('storage.buckets') is null then 1 else 0 end as sem_storage \gset
\if :sem_storage
  select skip('sem schema storage (Postgres de teste)', 1);
\else
  select is((select file_size_limit from storage.buckets where id = 'project-covers'), 4194304::bigint, 'bucket project-covers com 4 MB');
\endif

select * from finish();
rollback;
