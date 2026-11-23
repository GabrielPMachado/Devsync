-- Devsync: demos, projetos e curtidas.
--
-- Códigos de erro próprios (SQLSTATE), para o site mostrar mensagens claras:
--   DS001  limite diário de envios de demo atingido (5 por dia)
--   DS002  envio de demo exige e-mail confirmado (ou login pelo GitHub)
--   DS003  limite de 5 tags por pergunta ou projeto

-- Funções compartilhadas por projetos e perguntas ------------------------------

-- Gera slug único e imutável: "meu-app-de-tarefas-k3x9qa".
create function public.set_slug() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.slug := coalesce(nullif(public.slugify(new.title), ''), 'post')
    || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  return new;
end $$;

-- Limita a 5 tags por conteúdo. Usada por project_tags e question_tags.
create function public.enforce_max_tags() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
begin
  if tg_table_name = 'project_tags' then
    select count(*) into total from public.project_tags where project_id = new.project_id;
  else
    select count(*) into total from public.question_tags where question_id = new.question_id;
  end if;
  if total >= 5 then
    raise exception 'Máximo de 5 tags' using errcode = 'DS003';
  end if;
  return new;
end $$;

-- Demos -----------------------------------------------------------------------
-- status, embeddable, storage_prefix, version e checked_at são escritos só pelo
-- serviço de demos (service_role) ou pela moderação (admin_set_demo_status).

create table public.demos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.demo_kind not null,
  url text check (url ~ '^https://'),
  storage_prefix text,
  version integer not null default 1,
  status public.demo_status not null default 'pending',
  embeddable boolean,
  screenshot_url text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demos_link_has_url check (kind <> 'web_link' or url is not null),
  -- Demo enviada é servida pelo domínio de demos, nunca por URL do autor.
  constraint demos_upload_no_url check (kind <> 'web_upload' or url is null)
);
create index demos_owner_idx on public.demos (owner_id, created_at desc);

create trigger demos_updated_at before update on public.demos
  for each row execute function public.set_updated_at();

-- Registro só de inclusão dos envios de zip. Apagar a demo não apaga o
-- registro, então o limite diário não pode ser contornado apagando demos.
-- Sem políticas: só o gatilho abaixo escreve e lê.
create table public.demo_uploads (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index demo_uploads_owner_idx on public.demo_uploads (owner_id, created_at desc);
alter table public.demo_uploads enable row level security;
revoke all on public.demo_uploads from anon, authenticated;

-- Envio de zip: e-mail confirmado e no máximo 5 por dia por pessoa.
create function public.demos_check_upload() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'web_upload' then
    if not exists (select 1 from auth.users where id = new.owner_id and email_confirmed_at is not null) then
      raise exception 'Confirme seu e-mail para enviar demos' using errcode = 'DS002';
    end if;
    -- Serializa envios simultâneos da mesma pessoa antes de contar.
    perform pg_advisory_xact_lock(hashtext('demo_uploads:' || new.owner_id::text));
    if (select count(*) from public.demo_uploads
        where owner_id = new.owner_id and created_at > now() - interval '24 hours') >= 5 then
      raise exception 'Limite de 5 envios de demo por dia' using errcode = 'DS001';
    end if;
    insert into public.demo_uploads (owner_id) values (new.owner_id);
  end if;
  return new;
end $$;

create trigger demos_check_upload before insert on public.demos
  for each row execute function public.demos_check_upload();

-- Trocar a URL obriga nova checagem de embed. Demo bloqueada pela moderação
-- continua bloqueada (só admin_set_demo_status desbloqueia).
create function public.demos_reset_on_url_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.url is distinct from old.url then
    new.status := case when old.status = 'blocked' then 'blocked'::public.demo_status else 'pending' end;
    new.embeddable := null;
    new.checked_at := null;
  end if;
  return new;
end $$;

create trigger demos_reset_on_url_change before update of url on public.demos
  for each row execute function public.demos_reset_on_url_change();

alter table public.demos enable row level security;

-- unavailable continua visível: o site mostra "demo indisponível" em vez de tela branca.
create policy "demos publicadas são públicas" on public.demos
  for select using (status in ('live', 'unavailable') or owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "usuário ativo cria demo" on public.demos
  for insert to authenticated with check (owner_id = (select auth.uid()) and (select public.is_active_user()));
create policy "dono troca a url" on public.demos
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_active_user())) with check (owner_id = (select auth.uid()));
create policy "dono apaga demo" on public.demos
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke insert, update, delete on public.demos from anon;
revoke insert, update on public.demos from authenticated;
grant insert (kind, url) on public.demos to authenticated;
grant update (url) on public.demos to authenticated;

-- Projetos --------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  slug text not null unique,
  description_md text not null default '' check (char_length(description_md) <= 20000),
  repo_url text check (repo_url ~ '^https://'),
  site_url text check (site_url ~ '^https://'),
  cover_url text,
  demo_id uuid references public.demos (id) on delete set null,
  lang text not null default 'pt-BR',
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  hidden_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('portuguese', title), 'A')
    || setweight(to_tsvector('portuguese', description_md), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_author_idx on public.projects (author_id, created_at desc);
create index projects_created_idx on public.projects (created_at desc);
create index projects_search_idx on public.projects using gin (search);
create index projects_demo_idx on public.projects (demo_id);

create trigger projects_set_slug before insert on public.projects
  for each row execute function public.set_slug();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- A demo do projeto tem que ser do próprio autor.
create function public.projects_check_demo_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.demo_id is not null and not exists (
    select 1 from public.demos where id = new.demo_id and owner_id = new.author_id) then
    raise exception 'A demo precisa ser sua' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger projects_check_demo_owner before insert or update of demo_id on public.projects
  for each row execute function public.projects_check_demo_owner();

alter table public.projects enable row level security;

create policy "projetos visíveis" on public.projects
  for select using (hidden_at is null or author_id = (select auth.uid()) or (select public.is_admin()));
create policy "usuário ativo publica projeto" on public.projects
  for insert to authenticated with check (author_id = (select auth.uid()) and (select public.is_active_user()));
create policy "autor edita projeto" on public.projects
  for update to authenticated
  using (author_id = (select auth.uid()) and (select public.is_active_user())) with check (author_id = (select auth.uid()));
create policy "autor apaga projeto" on public.projects
  for delete to authenticated using (author_id = (select auth.uid()));

revoke insert, update, delete on public.projects from anon;
revoke insert, update on public.projects from authenticated;
grant insert (title, description_md, repo_url, site_url, cover_url, demo_id, lang) on public.projects to authenticated;
grant update (title, description_md, repo_url, site_url, cover_url, demo_id, lang) on public.projects to authenticated;

-- Tags do projeto --------------------------------------------------------------

create table public.project_tags (
  project_id uuid not null references public.projects (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (project_id, tag_id)
);
create index project_tags_tag_idx on public.project_tags (tag_id, project_id);

create trigger project_tags_max before insert on public.project_tags
  for each row execute function public.enforce_max_tags();

alter table public.project_tags enable row level security;

create policy "tags de projeto visíveis" on public.project_tags
  for select using (exists (select 1 from public.projects p where p.id = project_id));
create policy "autor marca tags" on public.project_tags
  for insert to authenticated with check (
    (select public.is_active_user())
    and exists (select 1 from public.projects p where p.id = project_id and p.author_id = (select auth.uid())));
create policy "autor desmarca tags" on public.project_tags
  for delete to authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and p.author_id = (select auth.uid())));

revoke insert, update, delete on public.project_tags from anon;
revoke update on public.project_tags from authenticated;

-- Curtidas --------------------------------------------------------------------

create table public.likes (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, project_id)
);
create index likes_project_idx on public.likes (project_id, created_at desc);

create function public.likes_counter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.projects set likes_count = likes_count + 1 where id = new.project_id;
  else
    update public.projects set likes_count = greatest(likes_count - 1, 0) where id = old.project_id;
  end if;
  return null;
end $$;

create trigger likes_counter after insert or delete on public.likes
  for each row execute function public.likes_counter();

alter table public.likes enable row level security;

create policy "curtidas são públicas" on public.likes for select using (true);
create policy "usuário ativo curte projeto visível" on public.likes
  for insert to authenticated with check (
    profile_id = (select auth.uid()) and (select public.is_active_user())
    and exists (select 1 from public.projects p where p.id = project_id and p.hidden_at is null));
create policy "cada um descurte" on public.likes
  for delete to authenticated using (profile_id = (select auth.uid()));

revoke insert, update, delete on public.likes from anon;
revoke update on public.likes from authenticated;
