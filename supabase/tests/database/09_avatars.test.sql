begin;
\ir ../helpers.psql
select plan(5);

-- Só faz sentido com o Supabase de verdade (schema storage). No Postgres de
-- teste (scripts/test-db.sh) os 5 testes são pulados.
select case when to_regclass('storage.buckets') is null then 1 else 0 end as sem_storage \gset
\if :sem_storage
  select skip('sem schema storage (Postgres de teste)', 5);
\else
  select tests.create_user('ana@x.dev', 'ana_av') as ana \gset
  select tests.create_user('bruno@x.dev', 'bruno_av') as bruno \gset

  select is((select public from storage.buckets where id = 'avatars'), true, 'bucket avatars é público');
  select is((select file_size_limit from storage.buckets where id = 'avatars'), 2097152::bigint, 'limite de 2 MB');

  select tests.login_as(:'ana');
  select lives_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('avatars', '%s/a.png', '%s') $$, :'ana', :'ana'),
    'dono envia na própria pasta');
  select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('avatars', '%s/b.png', '%s') $$, :'bruno', :'ana'),
    '42501', null, 'não envia na pasta de outra pessoa');

  reset role;
  update profiles set suspended_at = now() where id = :'ana';
  select tests.login_as(:'ana');
  select throws_ok(format($$ insert into storage.objects (bucket_id, name, owner) values ('avatars', '%s/c.png', '%s') $$, :'ana', :'ana'),
    '42501', null, 'suspenso não envia foto');
\endif

select * from finish();
rollback;
