begin;
\ir ../helpers.psql
select plan(22);

select tests.create_user('ana@x.dev', 'ana_pc') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno_pc') as bruno \gset
-- Foto do GitHub, vinda do cadastro.
update profiles set avatar_url = 'https://avatars.githubusercontent.com/u/1' where id = :'ana';

select has_column('profiles', 'headline', 'coluna headline');
select has_column('profiles', 'location', 'coluna location');
select has_column('profiles', 'status', 'coluna status');
select has_column('profiles', 'banner_url', 'coluna banner_url');
select has_column('profiles', 'banner_preset', 'coluna banner_preset');
select has_column('profiles', 'avatar_frame', 'coluna avatar_frame');
select has_column('profiles', 'accent', 'coluna accent');

select tests.login_as(:'ana');
select lives_ok($$ update profiles set headline = 'Dev front-end na Acme', location = 'São Paulo', status = 'open_to_work',
  banner_preset = 'circuito', avatar_frame = 'gradiente', accent = 'ciano' where id = auth.uid() $$, 'edita os campos novos');
select throws_ok($$ update profiles set headline = repeat('a', 81) where id = auth.uid() $$, '23514', null, 'cargo com mais de 80 falha');
select throws_ok($$ update profiles set location = repeat('a', 61) where id = auth.uid() $$, '23514', null, 'localização com mais de 60 falha');
select throws_ok($$ update profiles set status = 'dormindo' where id = auth.uid() $$, '23514', null, 'status fora da lista falha');
select throws_ok($$ update profiles set banner_preset = 'arcoiris' where id = auth.uid() $$, '23514', null, 'banner pronto fora da lista falha');
select throws_ok($$ update profiles set accent = 'preto' where id = auth.uid() $$, '23514', null, 'cor fora da lista falha');
select throws_ok($$ update profiles set avatar_frame = 'Ab!' where id = auth.uid() $$, '23514', null, 'borda com formato inválido falha');

-- Imagens: só a pasta da própria pessoa no Storage.
select lives_ok($$ update profiles set bio = 'oi' where id = auth.uid() $$, 'foto do GitHub inalterada não atrapalha salvar');
select throws_ok($$ update profiles set avatar_url = 'https://evil.example/x.png' where id = auth.uid() $$, '22023', null, 'foto externa nova falha');
select lives_ok(format($$ update profiles set avatar_url = 'https://abc.supabase.co/storage/v1/object/public/avatars/%s/avatar.webp?v=123' where id = auth.uid() $$, :'ana'),
  'foto da própria pasta passa');
select throws_ok(format($$ update profiles set avatar_url = 'https://abc.supabase.co/storage/v1/object/public/avatars/%s/avatar.webp' where id = auth.uid() $$, :'bruno'),
  '22023', null, 'foto da pasta de outra pessoa falha');
select lives_ok(format($$ update profiles set banner_url = 'http://127.0.0.1:54321/storage/v1/object/public/banners/%s/banner.webp?v=9' where id = auth.uid() $$, :'ana'),
  'banner da própria pasta passa');
select throws_ok(format($$ update profiles set banner_url = 'https://abc.supabase.co/storage/v1/object/public/avatars/%s/banner.webp' where id = auth.uid() $$, :'ana'),
  '22023', null, 'banner em outro bucket falha');
select lives_ok($$ update profiles set avatar_url = null, banner_url = null where id = auth.uid() $$, 'remover foto e banner passa');
reset role;

select case when to_regclass('storage.buckets') is null then 1 else 0 end as sem_storage \gset
\if :sem_storage
  select skip('sem schema storage (Postgres de teste)', 1);
\else
  select is((select file_size_limit from storage.buckets where id = 'banners'), 4194304::bigint, 'bucket banners com 4 MB');
\endif

select * from finish();
rollback;
