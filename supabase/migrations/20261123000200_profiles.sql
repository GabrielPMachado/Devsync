-- Devsync: perfis, tags e seguir.

-- Perfis ----------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Escolhido no primeiro acesso; nulo até lá.
  username text,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  links jsonb not null default '{}'::jsonb check (jsonb_typeof(links) = 'object'),
  locale text not null default 'pt-BR',
  role public.user_role not null default 'user',
  suspended_at timestamptz,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(username, '') || ' ' || coalesce(display_name, '')), 'A')
    || setweight(to_tsvector('portuguese', coalesce(bio, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  -- Nomes que colidem com rotas do site ou confundem com a equipe.
  constraint profiles_username_reserved check (username not in (
    'admin', 'api', 'perguntas', 'projetos', 'demo', 'u', 'tags', 'busca',
    'explorar', 'configuracoes', 'login', 'devsync', 'suporte', 'en'))
);

create unique index profiles_username_key on public.profiles (lower(username));
create index profiles_search_idx on public.profiles using gin (search);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Quem é admin e quem pode publicar. security definer para poderem ser usadas
-- dentro das políticas sem recursão de RLS.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and suspended_at is null)
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and suspended_at is null)
$$;

-- Cria o perfil quando a conta nasce no Supabase Auth.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name',
                  new.raw_user_meta_data ->> 'full_name',
                  new.raw_user_meta_data ->> 'user_name'), 80),
    new.raw_user_meta_data ->> 'avatar_url');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "perfis são públicos" on public.profiles
  for select using (true);
create policy "cada um edita o próprio perfil" on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, bio, links, locale) on public.profiles to authenticated;

-- Tags ------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9+#.-]{0,29}$'),
  name text not null check (char_length(name) between 1 and 40),
  description text check (char_length(description) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;

create policy "tags são públicas" on public.tags for select using (true);
create policy "usuário ativo cria tag" on public.tags
  for insert to authenticated
  with check (public.is_active_user() and created_by = auth.uid());
create policy "admin edita tag" on public.tags
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin apaga tag" on public.tags
  for delete to authenticated using (public.is_admin());

revoke insert, update, delete on public.tags from anon;
revoke insert, update on public.tags from authenticated;
grant insert (slug, name, description) on public.tags to authenticated;
grant update (name, description) on public.tags to authenticated;

-- Tecnologias do perfil e tags acompanhadas ----------------------------------

create table public.profile_tags (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (profile_id, tag_id)
);
create index profile_tags_tag_idx on public.profile_tags (tag_id);

create table public.tag_follows (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, tag_id)
);
create index tag_follows_tag_idx on public.tag_follows (tag_id);

alter table public.profile_tags enable row level security;
alter table public.tag_follows enable row level security;

create policy "tecnologias do perfil são públicas" on public.profile_tags for select using (true);
create policy "cada um escolhe as próprias tecnologias" on public.profile_tags
  for insert to authenticated with check (profile_id = auth.uid() and public.is_active_user());
create policy "cada um remove as próprias tecnologias" on public.profile_tags
  for delete to authenticated using (profile_id = auth.uid());

create policy "cada um vê as tags que acompanha" on public.tag_follows
  for select to authenticated using (profile_id = auth.uid());
create policy "cada um acompanha tags" on public.tag_follows
  for insert to authenticated with check (profile_id = auth.uid() and public.is_active_user());
create policy "cada um deixa de acompanhar" on public.tag_follows
  for delete to authenticated using (profile_id = auth.uid());

revoke insert, update, delete on public.profile_tags, public.tag_follows from anon;
revoke update on public.profile_tags, public.tag_follows from authenticated;

-- Seguir ----------------------------------------------------------------------
-- Unidirecional, como no GitHub.

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, created_at desc);

create function public.follows_counters() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
  else
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
  end if;
  return null;
end $$;

create trigger follows_counters after insert or delete on public.follows
  for each row execute function public.follows_counters();

alter table public.follows enable row level security;

create policy "seguidores são públicos" on public.follows for select using (true);
create policy "cada um segue em nome próprio" on public.follows
  for insert to authenticated with check (follower_id = auth.uid() and public.is_active_user());
create policy "cada um deixa de seguir" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

revoke insert, update, delete on public.follows from anon;
revoke update on public.follows from authenticated;
