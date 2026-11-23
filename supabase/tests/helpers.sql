-- Funções auxiliares dos testes pgTAP. Incluído no começo de cada teste com
-- \ir ../helpers.sql, dentro da transação do teste (some no rollback).

create extension if not exists pgtap with schema extensions;
create schema tests;
grant usage on schema tests to anon, authenticated;
set search_path = public, extensions;

-- Cria um usuário em auth.users (o gatilho cria o perfil) e, se pedido, já
-- define o @usuário. confirmed = false simula e-mail não confirmado.
create function tests.create_user(email text, username text default null, confirmed boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (uid, email, case when confirmed then now() end,
          jsonb_build_object('name', split_part(email, '@', 1),
                             'avatar_url', 'https://avatars.githubusercontent.com/u/1'));
  if username is not null then
    update public.profiles set username = create_user.username where id = uid;
  end if;
  return uid;
end $$;

-- Passa a agir como o usuário logado (papel authenticated + JWT com sub).
create function tests.login_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Passa a agir como visitante sem login.
create function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end $$;

-- Torna um perfil admin (roda como dono, fora da RLS).
create function tests.make_admin(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = 'admin' where id = uid;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
