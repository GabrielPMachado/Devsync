-- Lançamento: funções internas fora da API.
--
-- O Postgres dá EXECUTE a todo mundo (public) em funções novas, e o Supabase
-- também dá a anon e authenticated. Com isso, qualquer visitante chamava as
-- funções de gatilho por /rest/v1/rpc (avisos 0028 e 0029 do advisor).
-- Gatilhos não precisam de EXECUTE para disparar: o Postgres só confere essa
-- permissão no create trigger. Então tirar o EXECUTE não muda nada no site.
--
-- O laço pega todas as funções de gatilho que existirem em public quando a
-- migration roda. Funções de gatilho novas precisam do próprio revoke; o teste
-- 11_function_privileges.test.sql falha se alguém esquecer.

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- assert_admin só é chamada de dentro das funções admin_* (security definer,
-- rodam como dono). Ninguém precisa chamá-la direto.
revoke execute on function public.assert_admin() from public, anon, authenticated;
