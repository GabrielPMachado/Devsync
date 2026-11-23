-- Devsync: funções de leitura fixadas pelo roteiro da fase 1.
-- Todas são security invoker: a RLS de quem chama vale lá dentro.

-- Ordem das respostas (seção 5.4 da spec) -------------------------------------
-- 1. Respostas com 3+ marcações de "não funciona mais" vão para o fim (vale
--    também para a aceita).
-- 2. A aceita fica em primeiro, a não ser que uma resposta publicada depois
--    dela tenha score >= 5 e >= 2x o score da aceita: essa "desafiante" (a de
--    maior score, se houver várias) sobe para antes da aceita. O site mostra o
--    selo "mais votada recentemente" quando a primeira resposta não é a aceita
--    e a pergunta tem uma aceita.
-- 3. O resto por score, e no empate a mais nova primeiro.

create function public.answers_ordered(question_id uuid) returns setof public.answers
language sql stable security invoker set search_path = '' as $$
  with accepted as (
    select a.id, a.score, a.created_at
    from public.answers a
    join public.questions q on q.accepted_answer_id = a.id
    where q.id = answers_ordered.question_id
  ),
  challenger as (
    select a.id
    from public.answers a, accepted
    where a.question_id = answers_ordered.question_id
      and a.id <> accepted.id
      and a.created_at > accepted.created_at
      and a.outdated_flags < 3
      and a.score >= 5
      and a.score >= 2 * accepted.score
    order by a.score desc, a.created_at desc
    limit 1
  )
  select a.*
  from public.answers a
  where a.question_id = answers_ordered.question_id
  order by
    a.outdated_flags >= 3,
    case
      when a.id = (select id from challenger) then 0
      when a.id = (select id from accepted) then 1
      else 2
    end,
    a.score desc,
    a.created_at desc,
    a.id
$$;

-- Busca (seção 5.6) -----------------------------------------------------------
-- q no formato de busca da web ("react hooks", "-class", "\"use client\"").
-- tag_slugs nulo = sem filtro de tag. kinds nulo = question, project e profile.
-- Conteúdo oculto não aparece nem para o autor. Até 50 resultados.

create function public.search_content(q text, tag_slugs text[] default null, kinds text[] default null)
returns table (kind text, id uuid, title text, rank real)
language sql stable security invoker set search_path = '' as $$
  with query as (
    select websearch_to_tsquery('portuguese', coalesce(q, '')) as pt,
           websearch_to_tsquery('simple', coalesce(q, '')) as simple
  ),
  results as (
    select 'question'::text as kind, x.id, x.title, ts_rank(x.search, query.pt) as rank
    from public.questions x, query
    where (kinds is null or 'question' = any (kinds))
      and x.hidden_at is null
      and x.search @@ query.pt
      and (tag_slugs is null or exists (
        select 1 from public.question_tags qt join public.tags t on t.id = qt.tag_id
        where qt.question_id = x.id and t.slug = any (tag_slugs)))
    union all
    select 'project', x.id, x.title, ts_rank(x.search, query.pt)
    from public.projects x, query
    where (kinds is null or 'project' = any (kinds))
      and x.hidden_at is null
      and x.search @@ query.pt
      and (tag_slugs is null or exists (
        select 1 from public.project_tags pt join public.tags t on t.id = pt.tag_id
        where pt.project_id = x.id and t.slug = any (tag_slugs)))
    union all
    select 'profile', x.id, coalesce(x.display_name, x.username), ts_rank(x.search, query.simple || query.pt)
    from public.profiles x, query
    where (kinds is null or 'profile' = any (kinds))
      and x.suspended_at is null
      and x.search @@ (query.simple || query.pt)
      and (tag_slugs is null or exists (
        select 1 from public.profile_tags pt join public.tags t on t.id = pt.tag_id
        where pt.profile_id = x.id and t.slug = any (tag_slugs)))
  )
  select r.kind, r.id, r.title, r.rank
  from results r
  order by r.rank desc, r.id
  limit 50
$$;

-- Feed de início (seção 5.6) --------------------------------------------------
-- Projetos e perguntas de quem a pessoa segue, das tags que acompanha e dela
-- mesma, em ordem cronológica. Paginação por cursor: passe em "before" o
-- created_at do último item da página anterior. page_size vai de 1 a 50.

create function public.home_feed(before timestamptz default null, page_size integer default 20)
returns table (kind text, id uuid, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  with authors as (
    select f.followee_id as id from public.follows f where f.follower_id = auth.uid()
    union
    select auth.uid()
  ),
  followed_tags as (
    select tf.tag_id from public.tag_follows tf where tf.profile_id = auth.uid()
  ),
  feed as (
    (select 'project'::text as kind, p.id, p.created_at
     from public.projects p
     where p.hidden_at is null
       and (before is null or p.created_at < before)
       and (p.author_id in (select id from authors)
            or exists (select 1 from public.project_tags pt
                       where pt.project_id = p.id and pt.tag_id in (select tag_id from followed_tags)))
     order by p.created_at desc
     limit least(greatest(page_size, 1), 50))
    union all
    (select 'question'::text, q.id, q.created_at
     from public.questions q
     where q.hidden_at is null
       and (before is null or q.created_at < before)
       and (q.author_id in (select id from authors)
            or exists (select 1 from public.question_tags qt
                       where qt.question_id = q.id and qt.tag_id in (select tag_id from followed_tags)))
     order by q.created_at desc
     limit least(greatest(page_size, 1), 50))
  )
  select f.kind, f.id, f.created_at
  from feed f
  order by f.created_at desc, f.id
  limit least(greatest(page_size, 1), 50)
$$;
