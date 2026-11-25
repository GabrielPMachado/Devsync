-- Moderação de perfis e do catálogo de personalização.
-- Design: docs/superpowers/specs/2026-11-25-devsync-moderacao-perfis-design.md
-- O desenho dos itens continua no código (src/lib/social/profile-style.ts e badges.ts);
-- aqui só o estado: ligado/desligado, nome trocado, liberações manuais e o registro.

-- Registro das ações da moderação ------------------------------------------------

create table public.admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null check (action ~ '^[a-z_]{1,40}$'),
  profile_id uuid references public.profiles (id) on delete cascade,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_actions_profile_idx on public.admin_actions (profile_id, created_at desc);
create index admin_actions_admin_idx on public.admin_actions (admin_id);

alter table public.admin_actions enable row level security;
create policy "admins veem o registro" on public.admin_actions
  for select to authenticated using ((select public.is_admin()));
revoke all on public.admin_actions from anon, authenticated;
grant select on public.admin_actions to authenticated;

create function private.log_admin_action(act text, who uuid, info jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_actions (admin_id, action, profile_id, details)
  values (auth.uid(), act, who, coalesce(info, '{}'::jsonb))
$$;
revoke execute on function private.log_admin_action(text, uuid, jsonb) from public, anon, authenticated;

-- Estado do catálogo ---------------------------------------------------------------
-- Sem linha = ligado e com o nome do código. Item novo no código já nasce ligado.

create table public.catalog_item_state (
  kind text not null check (kind in ('banner', 'accent', 'frame', 'badge')),
  key text not null check (key ~ '^[a-z0-9_]{1,30}$'),
  active boolean not null default true,
  -- Sem { } < >: o nome entra nas mensagens do site (formato ICU).
  label text check (char_length(btrim(label)) between 1 and 40 and label !~ '[{}<>]'),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (kind, key)
);
create index catalog_item_state_updated_by_idx on public.catalog_item_state (updated_by);

alter table public.catalog_item_state enable row level security;
create policy "estado do catálogo é público" on public.catalog_item_state for select using (true);
revoke all on public.catalog_item_state from anon, authenticated;
grant select on public.catalog_item_state to anon, authenticated;

create function public.catalog_item_active(p_kind text, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.catalog_item_state s
    where s.kind = p_kind and s.key = p_key and not s.active)
$$;

-- Liberações manuais (item dado pela moderação a uma pessoa) ------------------------
-- Valem mesmo com o item desligado: assim dá para ter item exclusivo.

create table public.profile_item_grants (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('banner', 'accent', 'frame')),
  key text not null check (key ~ '^[a-z0-9_]{1,30}$'),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (profile_id, kind, key)
);
create index profile_item_grants_granted_by_idx on public.profile_item_grants (granted_by);

alter table public.profile_item_grants enable row level security;
create policy "liberações são públicas" on public.profile_item_grants for select using (true);
revoke all on public.profile_item_grants from anon, authenticated;
grant select on public.profile_item_grants to anon, authenticated;

create function private.has_item_grant(who uuid, p_kind text, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profile_item_grants g
    where g.profile_id = who and g.kind = p_kind and g.key = p_key)
$$;
revoke execute on function private.has_item_grant(uuid, text, text) from public, anon, authenticated;

-- Insígnia que libera o item (borda, banner ou cor), ou null se é livre.
create function private.required_badge(p_kind text, p_key text) returns text
language sql stable security definer set search_path = '' as $$
  select case p_kind
    when 'frame' then public.frame_required_badge(p_key)
    when 'banner' then public.banner_required_badge(p_key)
    when 'accent' then public.accent_required_badge(p_key)
  end
$$;
revoke execute on function private.required_badge(text, text) from public, anon, authenticated;

-- Pode usar o item? Liberado à mão, ou ligado e (se for por conquista) com a insígnia.
create function private.item_allowed(who uuid, p_kind text, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_key is null
    or private.has_item_grant(who, p_kind, p_key)
    or (public.catalog_item_active(p_kind, p_key)
        and (private.required_badge(p_kind, p_key) is null
             or exists (select 1 from public.user_badges u
                        where u.profile_id = who and u.badge = private.required_badge(p_kind, p_key))))
$$;
revoke execute on function private.item_allowed(uuid, text, text) from public, anon, authenticated;

-- Gatilhos: insígnia desligada não é mais dada -----------------------------------------

create or replace function private.award_badge(who uuid, key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.catalog_item_active('badge', key) then
    return;
  end if;
  insert into public.user_badges (profile_id, badge) values (who, key)
  on conflict do nothing;
  if found then
    insert into public.notifications (recipient_id, type, actor_id, target_type, target_id, badge)
    values (who, 'badge', null, 'profile', who, key);
  end if;
end $$;
revoke execute on function private.award_badge(uuid, text) from public, anon, authenticated;

-- Fundador desligado não gasta vaga de fundador.
create or replace function private.badges_on_username() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.username is not null then
    return null; -- trocar de @ não conta como chegar agora
  end if;
  if not public.catalog_item_active('badge', 'founder') then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('devsync_founder_badge'));
  if exists (select 1 from public.user_badges where profile_id = new.id and badge = 'founder') then
    return null;
  end if;
  update private.founder_slots set used = used + 1 where used < 1000;
  if found then
    perform private.award_badge(new.id, 'founder');
  end if;
  return null;
end $$;
revoke execute on function private.badges_on_username() from public, anon, authenticated;

-- Escolha no editor (junta com 20261125300000_profile_catalog_v3): item bloqueado (DS005) e
-- item desligado (DS006) são recusados, menos se a moderação liberou para a pessoa.
-- Só confere o que mudou: quem já usa um item desligado continua com ele.
create or replace function private.profiles_check_badges() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owns text[] := array(select u.badge from public.user_badges u where u.profile_id = new.id);
  item record;
  needed text;
begin
  if new.shown_badges is distinct from old.shown_badges then
    if cardinality(new.shown_badges) <> (select count(distinct b) from unnest(new.shown_badges) b)
       or exists (select 1 from unnest(new.shown_badges) b where not (b = any (owns))) then
      raise exception 'Você só pode exibir insígnias que conquistou, sem repetir' using errcode = 'DS004';
    end if;
  end if;
  for item in
    select * from (values
      ('frame', new.avatar_frame, new.avatar_frame is distinct from old.avatar_frame),
      ('banner', new.banner_preset, new.banner_preset is distinct from old.banner_preset),
      ('accent', new.accent, new.accent is distinct from old.accent)) as v(kind, key, changed)
  loop
    continue when not item.changed or item.key is null or private.has_item_grant(new.id, item.kind, item.key);
    needed := private.required_badge(item.kind, item.key);
    if needed is not null and not (needed = any (owns)) then
      raise exception 'Esse item ainda está bloqueado' using errcode = 'DS005';
    end if;
    if not public.catalog_item_active(item.kind, item.key) then
      raise exception 'Esse item não está disponível' using errcode = 'DS006';
    end if;
  end loop;
  return new;
end $$;
revoke execute on function private.profiles_check_badges() from public, anon, authenticated;

drop trigger profiles_check_badges on public.profiles;
create trigger profiles_check_badges
  before update of shown_badges, avatar_frame, banner_preset, accent on public.profiles
  for each row execute function private.profiles_check_badges();

-- Depois de tirar uma insígnia ou uma liberação, só o que dependia dela volta ao padrão.
-- Nada mais é conferido de novo: um item desligado que a pessoa já usava continua com ela.
create function private.after_badge_revoked(who uuid, badge text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set
    shown_badges = array_remove(p.shown_badges, badge),
    avatar_frame = case when private.required_badge('frame', p.avatar_frame) = badge
                        and not private.has_item_grant(who, 'frame', p.avatar_frame) then null else p.avatar_frame end,
    banner_preset = case when private.required_badge('banner', p.banner_preset) = badge
                         and not private.has_item_grant(who, 'banner', p.banner_preset) then null else p.banner_preset end,
    accent = case when private.required_badge('accent', p.accent) = badge
                  and not private.has_item_grant(who, 'accent', p.accent) then null else p.accent end
  where p.id = who;
end $$;
revoke execute on function private.after_badge_revoked(uuid, text) from public, anon, authenticated;

create function private.after_grant_revoked(who uuid, p_kind text, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set
    avatar_frame = case when p_kind = 'frame' and p.avatar_frame = p_key
                        and not private.item_allowed(who, 'frame', p_key) then null else p.avatar_frame end,
    banner_preset = case when p_kind = 'banner' and p.banner_preset = p_key
                         and not private.item_allowed(who, 'banner', p_key) then null else p.banner_preset end,
    accent = case when p_kind = 'accent' and p.accent = p_key
                  and not private.item_allowed(who, 'accent', p_key) then null else p.accent end
  where p.id = who;
end $$;
revoke execute on function private.after_grant_revoked(uuid, text, text) from public, anon, authenticated;

-- RPCs da moderação ----------------------------------------------------------------

create function private.assert_profile(who uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = who) then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function private.assert_profile(uuid) from public, anon, authenticated;

-- Liga/desliga e renomeia (label vazio = volta ao nome do código).
create function public.admin_set_catalog_item(p_kind text, p_key text, p_active boolean, p_label text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  clean text := nullif(btrim(p_label), '');
begin
  perform public.assert_admin();
  if p_kind = 'badge' and not (p_key = any (public.badge_keys())) then
    raise exception 'Insígnia desconhecida' using errcode = '22023';
  end if;
  insert into public.catalog_item_state (kind, key, active, label, updated_by, updated_at)
  values (p_kind, p_key, p_active, clean, auth.uid(), now())
  on conflict (kind, key) do update
    set active = excluded.active, label = excluded.label,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  perform private.log_admin_action('catalog_item', null,
    jsonb_build_object('kind', p_kind, 'key', p_key, 'active', p_active, 'label', clean));
end $$;

create function public.admin_award_badge(p_profile uuid, p_badge text, p_notify boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  perform private.assert_profile(p_profile);
  if not (p_badge = any (public.badge_keys())) then
    raise exception 'Insígnia desconhecida' using errcode = '22023';
  end if;
  insert into public.user_badges (profile_id, badge) values (p_profile, p_badge)
  on conflict do nothing;
  if not found then
    return;
  end if;
  if p_notify then
    insert into public.notifications (recipient_id, type, actor_id, target_type, target_id, badge)
    values (p_profile, 'badge', null, 'profile', p_profile, p_badge);
  end if;
  perform private.log_admin_action('award_badge', p_profile, jsonb_build_object('badge', p_badge, 'notify', p_notify));
end $$;

create function public.admin_revoke_badge(p_profile uuid, p_badge text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  perform private.assert_profile(p_profile);
  delete from public.user_badges where profile_id = p_profile and badge = p_badge;
  if not found then
    return;
  end if;
  perform private.after_badge_revoked(p_profile, p_badge);
  perform private.log_admin_action('revoke_badge', p_profile, jsonb_build_object('badge', p_badge));
end $$;

create function public.admin_grant_item(p_profile uuid, p_kind text, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  perform private.assert_profile(p_profile);
  insert into public.profile_item_grants (profile_id, kind, key, granted_by)
  values (p_profile, p_kind, p_key, auth.uid())
  on conflict do nothing;
  if found then
    perform private.log_admin_action('grant_item', p_profile, jsonb_build_object('kind', p_kind, 'key', p_key));
  end if;
end $$;

create function public.admin_revoke_item(p_profile uuid, p_kind text, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  perform private.assert_profile(p_profile);
  delete from public.profile_item_grants where profile_id = p_profile and kind = p_kind and key = p_key;
  if not found then
    return;
  end if;
  perform private.after_grant_revoked(p_profile, p_kind, p_key);
  perform private.log_admin_action('revoke_item', p_profile, jsonb_build_object('kind', p_kind, 'key', p_key));
end $$;

-- Edita dados do perfil. Chaves aceitas em p_changes:
-- username, display_name, headline, location, status, bio (texto; vazio = limpar, menos username),
-- remove_avatar, remove_banner, reset_appearance (true).
create function public.admin_update_profile(p_profile uuid, p_changes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  allowed constant text[] := array['username', 'display_name', 'headline', 'location', 'status', 'bio',
                                   'remove_avatar', 'remove_banner', 'reset_appearance'];
  fields constant text[] := array['username', 'display_name', 'headline', 'location', 'status', 'bio',
                                  'avatar_url', 'banner_url', 'banner_preset', 'accent', 'avatar_frame'];
  before_row jsonb;
  after_row jsonb;
  diff jsonb := '{}'::jsonb;
  f text;
  c jsonb := coalesce(p_changes, '{}'::jsonb);
  flag constant text := 'true';
begin
  perform public.assert_admin();
  perform private.assert_profile(p_profile);
  if jsonb_typeof(c) <> 'object' or exists (select 1 from jsonb_object_keys(c) k where not (k = any (allowed))) then
    raise exception 'Alteração inválida' using errcode = '22023';
  end if;
  if c ? 'username' and nullif(btrim(c->>'username'), '') is null then
    raise exception 'O @ não pode ficar vazio' using errcode = '22023';
  end if;

  select to_jsonb(p) into before_row from public.profiles p where p.id = p_profile;

  update public.profiles p set
    username = case when c ? 'username' then lower(btrim(c->>'username')) else p.username end,
    display_name = case when c ? 'display_name' then nullif(btrim(c->>'display_name'), '') else p.display_name end,
    headline = case when c ? 'headline' then nullif(btrim(c->>'headline'), '') else p.headline end,
    location = case when c ? 'location' then nullif(btrim(c->>'location'), '') else p.location end,
    status = case when c ? 'status' then nullif(btrim(c->>'status'), '') else p.status end,
    bio = case when c ? 'bio' then nullif(btrim(c->>'bio'), '') else p.bio end,
    avatar_url = case when c->>'remove_avatar' = flag then null else p.avatar_url end,
    banner_url = case when c->>'remove_banner' = flag then null else p.banner_url end,
    banner_preset = case when c->>'reset_appearance' = flag then null else p.banner_preset end,
    accent = case when c->>'reset_appearance' = flag then null else p.accent end,
    avatar_frame = case when c->>'reset_appearance' = flag then null else p.avatar_frame end
  where p.id = p_profile;

  select to_jsonb(p) into after_row from public.profiles p where p.id = p_profile;
  foreach f in array fields loop
    if before_row->f is distinct from after_row->f then
      diff := diff || jsonb_build_object(f, jsonb_build_object('from', before_row->f, 'to', after_row->f));
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    perform private.log_admin_action('update_profile', p_profile, diff);
  end if;
end $$;

-- Busca de perfis para o /admin (por @ ou nome). Vazio = os mais recentes.
create function public.admin_find_profiles(p_query text default '')
returns table (id uuid, username text, display_name text, avatar_url text, is_admin boolean, suspended boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  term text := ltrim(lower(btrim(coalesce(p_query, ''))), '@');
  -- Para o LIKE: \, % e _ viram texto comum.
  q text := replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_');
begin
  perform public.assert_admin();
  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.role = 'admin', p.suspended_at is not null, p.created_at
  from public.profiles p
  where q = '' or lower(p.username) like '%' || q || '%' or lower(p.display_name) like '%' || q || '%'
  order by (lower(p.username) = term) desc, p.created_at desc
  limit 30;
end $$;

-- Tudo o que a página do perfil no /admin precisa.
create function public.admin_get_profile(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return (
    select jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name, 'headline', p.headline,
      'location', p.location, 'status', p.status, 'bio', p.bio, 'avatar_url', p.avatar_url,
      'banner_url', p.banner_url, 'banner_preset', p.banner_preset, 'accent', p.accent,
      'avatar_frame', p.avatar_frame, 'is_admin', p.role = 'admin', 'suspended', p.suspended_at is not null,
      'created_at', p.created_at,
      'badges', coalesce((select jsonb_agg(jsonb_build_object('badge', u.badge, 'awarded_at', u.awarded_at) order by u.awarded_at)
                          from public.user_badges u where u.profile_id = p.id), '[]'::jsonb),
      'grants', coalesce((select jsonb_agg(jsonb_build_object('kind', g.kind, 'key', g.key) order by g.granted_at)
                          from public.profile_item_grants g where g.profile_id = p.id), '[]'::jsonb),
      'history', coalesce((select jsonb_agg(h order by h.created_at desc) from (
                            select a.id, a.action, a.details, a.created_at, ad.username as admin_username
                            from public.admin_actions a left join public.profiles ad on ad.id = a.admin_id
                            where a.profile_id = p.id order by a.created_at desc limit 50) h), '[]'::jsonb))
    from public.profiles p where p.id = p_profile);
end $$;

revoke execute on function
  public.admin_set_catalog_item(text, text, boolean, text),
  public.admin_award_badge(uuid, text, boolean),
  public.admin_revoke_badge(uuid, text),
  public.admin_grant_item(uuid, text, text),
  public.admin_revoke_item(uuid, text, text),
  public.admin_update_profile(uuid, jsonb),
  public.admin_find_profiles(text),
  public.admin_get_profile(uuid)
  from public, anon;
grant execute on function
  public.admin_set_catalog_item(text, text, boolean, text),
  public.admin_award_badge(uuid, text, boolean),
  public.admin_revoke_badge(uuid, text),
  public.admin_grant_item(uuid, text, text),
  public.admin_revoke_item(uuid, text, text),
  public.admin_update_profile(uuid, jsonb),
  public.admin_find_profiles(text),
  public.admin_get_profile(uuid)
  to authenticated;

-- A função de permissões (PR #11) passa a conhecer as tabelas e RPCs novas.
create or replace function private.apply_api_grants() returns void
language plpgsql set search_path = '' as $fn$
declare
  f regprocedure;
begin
  grant select, insert, update, delete, truncate, references, trigger
    on all tables in schema public to anon, authenticated, service_role;
  grant usage, select, update on all sequences in schema public to anon, authenticated, service_role;

  -- Repetição dos revokes/grants das migrations anteriores, na ordem original.
  revoke insert, update, delete on public.revisions from anon, authenticated;
  revoke insert, update, delete on public.profiles from anon, authenticated;
  grant update (username, display_name, avatar_url, bio, links, locale,
    headline, location, status, banner_url, banner_preset, avatar_frame, accent, shown_badges) on public.profiles to authenticated;
  revoke insert, update, delete on public.tags from anon;
  revoke insert, update on public.tags from authenticated;
  grant insert (slug, name, description) on public.tags to authenticated;
  grant update (name, description) on public.tags to authenticated;
  revoke insert, update, delete on public.profile_tags, public.tag_follows from anon;
  revoke update on public.profile_tags, public.tag_follows from authenticated;
  revoke insert, update, delete on public.follows from anon;
  revoke update on public.follows from authenticated;
  revoke all on public.demo_uploads from anon, authenticated;
  revoke insert, update, delete on public.demos from anon;
  revoke insert, update on public.demos from authenticated;
  grant insert (kind, url) on public.demos to authenticated;
  grant update (url) on public.demos to authenticated;
  revoke insert, update, delete on public.projects from anon;
  revoke insert, update on public.projects from authenticated;
  grant insert (title, description_md, repo_url, site_url, cover_url, demo_id, lang) on public.projects to authenticated;
  grant update (title, description_md, repo_url, site_url, cover_url, demo_id, lang) on public.projects to authenticated;
  revoke insert, update, delete on public.project_tags from anon;
  revoke update on public.project_tags from authenticated;
  revoke insert, update, delete on public.likes from anon;
  revoke update on public.likes from authenticated;
  revoke insert, update, delete on public.questions from anon;
  revoke insert, update on public.questions from authenticated;
  grant insert (title, body_md, project_id, lang) on public.questions to authenticated;
  grant update (title, body_md, project_id, accepted_answer_id, lang) on public.questions to authenticated;
  revoke insert, update, delete on public.question_tags from anon;
  revoke update on public.question_tags from authenticated;
  revoke insert, update, delete on public.answers from anon;
  revoke insert, update on public.answers from authenticated;
  grant insert (question_id, body_md, demo_id, tech_version, lang) on public.answers to authenticated;
  grant update (body_md, demo_id, tech_version) on public.answers to authenticated;
  revoke insert, update, delete on public.answer_votes from anon;
  revoke insert, update on public.answer_votes from authenticated;
  grant insert (answer_id, value) on public.answer_votes to authenticated;
  grant update (value) on public.answer_votes to authenticated;
  revoke insert, update, delete on public.outdated_flags from anon;
  revoke insert, update on public.outdated_flags from authenticated;
  grant insert (answer_id) on public.outdated_flags to authenticated;
  revoke insert, update, delete on public.detail_requests from anon;
  revoke insert, update on public.detail_requests from authenticated;
  grant insert (question_id) on public.detail_requests to authenticated;
  revoke insert, update, delete on public.comments from anon;
  revoke insert, update on public.comments from authenticated;
  grant insert (target_type, target_id, parent_id, body_md) on public.comments to authenticated;
  grant update (body_md) on public.comments to authenticated;
  revoke insert, update, delete on public.notifications from anon;
  revoke insert, update on public.notifications from authenticated;
  grant update (read_at) on public.notifications to authenticated;
  revoke all on public.demo_builds from anon, authenticated;
  grant select on public.demo_builds to authenticated;
  revoke all on public.user_badges from anon, authenticated;
  grant select on public.user_badges to anon, authenticated;
  revoke insert, update, delete on public.reports from anon;
  revoke insert, update, delete on public.reports from authenticated;
  grant insert (target_type, target_id, reason) on public.reports to authenticated;
  revoke insert, update, delete on public.blocked_domains from anon, authenticated;
  revoke all on public.admin_actions from anon, authenticated;
  grant select on public.admin_actions to authenticated;
  revoke all on public.catalog_item_state from anon, authenticated;
  grant select on public.catalog_item_state to anon, authenticated;
  revoke all on public.profile_item_grants from anon, authenticated;
  grant select on public.profile_item_grants to anon, authenticated;

  -- Funções. Sem o padrão antigo, authenticated nunca ganhou EXECUTE nas
  -- funções de admin (as migrations só tiravam de public e anon). Elas mesmas
  -- conferem se quem chama é admin (assert_admin).
  grant execute on function
    public.admin_set_hidden(public.report_target, uuid, boolean),
    public.admin_suspend_profile(uuid, boolean),
    public.admin_set_demo_status(uuid, public.demo_status),
    public.admin_resolve_report(uuid, public.report_status),
    public.admin_mark_duplicate(uuid, uuid),
    public.admin_block_domain(text, text),
    public.admin_unblock_domain(text),
    public.admin_report_queue(public.report_status),
    public.admin_resolve_target(public.report_target, uuid, public.report_status),
    public.admin_set_catalog_item(text, text, boolean, text),
    public.admin_award_badge(uuid, text, boolean),
    public.admin_revoke_badge(uuid, text),
    public.admin_grant_item(uuid, text, text),
    public.admin_revoke_item(uuid, text, text),
    public.admin_update_profile(uuid, jsonb),
    public.admin_find_profiles(text),
    public.admin_get_profile(uuid)
    to authenticated;

  -- service_role (Worker de demos e tarefas do servidor) executa tudo, como no
  -- padrão antigo.
  grant execute on all functions in schema public to service_role;

  -- As funções que ficam abertas (leitura, RLS) continuam valendo para anon e
  -- authenticated. Só as que já estavam abertas a public: as fechadas seguem
  -- fechadas porque o revoke delas tirou de public, anon e authenticated.
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('public', p.oid, 'execute')
  loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;

  -- Tabelas, sequências e funções criadas daqui em diante pelo dono das
  -- migrations (postgres) seguem o padrão antigo, igual ao Supabase local.
  alter default privileges for role postgres in schema public
    grant select, insert, update, delete, truncate, references, trigger on tables to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant usage, select, update on sequences to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public
    grant execute on functions to anon, authenticated, service_role;
end
$fn$;

revoke execute on function private.apply_api_grants() from public, anon, authenticated;
