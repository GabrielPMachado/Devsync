-- Moderação (subprojeto 7): domínios bloqueados para demos, fila do /admin
-- agrupada por conteúdo e resolução de todas as denúncias de um alvo.
-- As tabelas reports, hidden_at, suspended_at e as RPCs básicas de admin vêm
-- de 20261123000600_notifications.sql.

-- Domínios bloqueados -----------------------------------------------------------

-- Domínio de uma URL https, em minúsculas, sem usuário, porta nem "www.".
create function public.url_host(url text) returns text
language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(lower(substring(url from '^https?://(?:[^@/?#]*@)?([^/:?#]+)')), '^www\.', ''), '')
$$;

-- Normaliza o que o admin digitou: aceita "golpe.dev", "WWW.Golpe.dev" ou uma URL.
create function public.normalize_domain(input text) returns text
language sql immutable set search_path = '' as $$
  select case
    when btrim(input) ~* '^https?://' then public.url_host(btrim(input))
    else nullif(regexp_replace(rtrim(lower(btrim(input)), '/.'), '^www\.', ''), '')
  end
$$;

create table public.blocked_domains (
  domain text primary key check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  reason text check (char_length(reason) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index blocked_domains_created_by_idx on public.blocked_domains (created_by);

alter table public.blocked_domains enable row level security;
create policy "admins veem domínios bloqueados" on public.blocked_domains
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.blocked_domains from anon, authenticated;

-- true quando o host é o domínio bloqueado ou um subdomínio dele.
create function public.is_blocked_url(url text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocked_domains b, (select public.url_host(url) as host) h
    where h.host = b.domain or h.host like '%.' || b.domain)
$$;

create function public.demos_check_blocked_domain() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.url is not null and public.is_blocked_url(new.url) then
    raise exception 'Domínio bloqueado' using errcode = 'P0001',
      hint = 'Este domínio foi bloqueado pela moderação da Devsync.';
  end if;
  return new;
end $$;

create trigger demos_check_blocked_domain before insert or update of url on public.demos
  for each row execute function public.demos_check_blocked_domain();

-- Bloqueia o domínio e tira do ar na hora as demos que apontam para ele.
create function public.admin_block_domain(domain text, reason text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  d text := public.normalize_domain(domain);
begin
  perform public.assert_admin();
  if d is null or d !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then
    raise exception 'Domínio inválido' using errcode = '22023';
  end if;
  insert into public.blocked_domains (domain, reason, created_by)
  values (d, nullif(btrim(admin_block_domain.reason), ''), auth.uid())
  on conflict on constraint blocked_domains_pkey do update set reason = excluded.reason;
  update public.demos set status = 'blocked'
  where kind = 'web_link' and status <> 'blocked'
    and (public.url_host(url) = d or public.url_host(url) like '%.' || d);
  return d;
end $$;

-- Desbloquear o domínio não reativa demos: cada uma volta pela fila.
create function public.admin_unblock_domain(domain text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  delete from public.blocked_domains b where b.domain = public.normalize_domain(admin_unblock_domain.domain);
end $$;

-- Fila do /admin ----------------------------------------------------------------

-- Denúncias agrupadas por alvo, com a prévia do conteúdo. Abertas: mais
-- denunciadas primeiro. Resolvidas: as 50 mais recentes.
create function public.admin_report_queue(p_status public.report_status default 'open')
returns table (
  target_type public.report_target,
  target_id uuid,
  report_count integer,
  reasons text[],
  first_reported_at timestamptz,
  last_reported_at timestamptz,
  resolved_at timestamptz,
  title text,
  preview text,
  path text,
  hidden boolean,
  demo_status public.demo_status,
  author_id uuid,
  author_username text,
  author_suspended boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
  with grouped as (
    select r.target_type, r.target_id,
           count(*)::integer as report_count,
           array_agg(r.reason order by r.created_at) as reasons,
           min(r.created_at) as first_reported_at,
           max(r.created_at) as last_reported_at,
           max(r.resolved_at) as resolved_at
    from public.reports r
    where r.status = p_status
    group by r.target_type, r.target_id
    order by
      case when p_status = 'open' then count(*) end desc nulls last,
      case when p_status = 'open' then min(r.created_at) end asc,
      max(r.resolved_at) desc nulls last
    limit case when p_status = 'open' then 200 else 50 end
  )
  select g.target_type, g.target_id, g.report_count, g.reasons,
         g.first_reported_at, g.last_reported_at, g.resolved_at,
         t.title, t.preview, t.path, coalesce(t.hidden, false), t.demo_status,
         p.id, p.username, p.suspended_at is not null
  from grouped g
  left join lateral (
    select pr.title, left(pr.description_md, 280) as preview, '/projetos/' || pr.slug as path,
           pr.hidden_at is not null as hidden, null::public.demo_status as demo_status, pr.author_id
    from public.projects pr where g.target_type = 'project' and pr.id = g.target_id
    union all
    select q.title, left(q.body_md, 280), '/estudos/' || q.slug,
           q.hidden_at is not null, null, q.author_id
    from public.questions q where g.target_type = 'question' and q.id = g.target_id
    union all
    select q.title, left(a.body_md, 280), '/estudos/' || q.slug || '#resposta-' || a.id,
           a.hidden_at is not null, null, a.author_id
    from public.answers a join public.questions q on q.id = a.question_id
    where g.target_type = 'answer' and a.id = g.target_id
    union all
    select null, left(c.body_md, 280),
           case c.target_type
             when 'project' then (select '/projetos/' || x.slug || '#comentarios' from public.projects x where x.id = c.target_id)
             when 'question' then (select '/estudos/' || x.slug from public.questions x where x.id = c.target_id)
             when 'answer' then (select '/estudos/' || x.slug || '#resposta-' || y.id
                                 from public.answers y join public.questions x on x.id = y.question_id where y.id = c.target_id)
           end,
           c.hidden_at is not null, null, c.author_id
    from public.comments c where g.target_type = 'comment' and c.id = g.target_id
    union all
    select coalesce(d.url, 'Demo enviada'), null,
           coalesce((select '/projetos/' || x.slug || '?demo=' || d.id from public.projects x where x.demo_id = d.id limit 1),
                    '/demo/' || d.id),
           d.status = 'blocked', d.status, d.owner_id
    from public.demos d where g.target_type = 'demo' and d.id = g.target_id
    union all
    select coalesce(pf.display_name, pf.username), left(pf.bio, 280), '/@' || pf.username,
           false, null, pf.id
    from public.profiles pf where g.target_type = 'profile' and pf.id = g.target_id
  ) t on true
  left join public.profiles p on p.id = t.author_id
  order by
    case when p_status = 'open' then g.report_count end desc nulls last,
    case when p_status = 'open' then g.first_reported_at end asc,
    g.resolved_at desc nulls last;
end $$;

-- Fecha de uma vez todas as denúncias abertas de um alvo.
create function public.admin_resolve_target(target public.report_target, target_id uuid, status public.report_status)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  perform public.assert_admin();
  if status = 'open' then
    raise exception 'Use actioned ou dismissed' using errcode = '22023';
  end if;
  update public.reports r
  set status = admin_resolve_target.status, resolved_by = auth.uid(), resolved_at = now()
  where r.target_type = admin_resolve_target.target and r.target_id = admin_resolve_target.target_id and r.status = 'open';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function
  public.admin_block_domain(text, text),
  public.admin_unblock_domain(text),
  public.admin_report_queue(public.report_status),
  public.admin_resolve_target(public.report_target, uuid, public.report_status),
  public.is_blocked_url(text)
  from public, anon;
revoke execute on function public.demos_check_blocked_domain() from public, anon, authenticated;
