-- Devsync: leituras da parte social e da descoberta (subprojeto 6).
-- Só funções security invoker: a RLS de quem chama vale lá dentro.

-- Projetos em alta (Explorar, seção 5.6) --------------------------------------
-- Curtidas dos últimos 7 dias, cada uma com peso 1 / (1 + idade em dias): uma
-- curtida de agora vale 1, uma de 3 dias atrás vale 0,25. Empate pelo total de
-- curtidas e depois o mais novo. Ocultos ficam de fora até para o autor.
-- page_size vai de 1 a 50.

create function public.trending_projects(page_size integer default 12)
returns table (id uuid, score double precision)
language sql stable security invoker set search_path = '' as $$
  select p.id,
         coalesce(sum(1.0 / (1.0 + extract(epoch from (now() - l.created_at)) / 86400.0))
                  filter (where l.created_at > now() - interval '7 days'), 0)::double precision as score
  from public.projects p
  left join public.likes l on l.project_id = p.id and l.created_at > now() - interval '7 days'
  where p.hidden_at is null
  group by p.id
  order by score desc, p.likes_count desc, p.created_at desc, p.id
  limit least(greatest(page_size, 1), 50)
$$;

-- Quem seguir -----------------------------------------------------------------
-- Perfis ativos, com @, que não são quem chama nem já seguidos por ele. Primeiro
-- quem usa mais das tecnologias que quem chama usa ou acompanha, depois quem tem mais seguidores.
-- Visitante recebe os mais seguidos. page_size vai de 1 a 50.

create function public.suggested_profiles(page_size integer default 5)
returns table (id uuid)
language sql stable security invoker set search_path = '' as $$
  select p.id
  from public.profiles p
  where p.username is not null
    and p.suspended_at is null
    and p.id is distinct from auth.uid()
    and not exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  order by
    (select count(*) from public.profile_tags theirs
     where theirs.profile_id = p.id
       and theirs.tag_id in (select pt.tag_id from public.profile_tags pt where pt.profile_id = auth.uid()
                             union
                             select tf.tag_id from public.tag_follows tf where tf.profile_id = auth.uid())) desc,
    p.followers_count desc,
    p.created_at desc,
    p.id
  limit least(greatest(page_size, 1), 50)
$$;
