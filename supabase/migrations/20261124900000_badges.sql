-- Devsync: insígnias conquistadas e bordas de avatar liberadas por conquista
-- (parte 2 do perfil personalizado, docs/superpowers/specs/2026-11-24-devsync-perfil-personalizado-design.md).
--
-- A conquista é gravada por gatilhos na hora em que acontece e é permanente:
-- apagar o conteúdo depois não tira a insígnia. Ninguém escreve em
-- user_badges pela API. O catálogo espelha src/lib/social/badges.ts.

alter type public.notification_type add value if not exists 'badge';

-- Catálogo --------------------------------------------------------------------

create function public.badge_keys() returns text[]
language sql immutable set search_path = '' as $$
  select array['founder', 'first_project', 'builder', 'curious', 'first_accepted', 'mentor', 'popular']
$$;

-- Qual insígnia libera cada borda. Bordas fora daqui são livres para todos.
create function public.frame_required_badge(frame text) returns text
language sql immutable set search_path = '' as $$
  select case frame
    when 'neon' then 'mentor'
    when 'colchetes' then 'builder'
    when 'dourada' then 'founder'
  end
$$;

-- Tabela ----------------------------------------------------------------------

create table public.user_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge text not null check (badge = any (public.badge_keys())),
  awarded_at timestamptz not null default now(),
  primary key (profile_id, badge)
);
create index user_badges_badge_idx on public.user_badges (badge);

alter table public.user_badges enable row level security;
create policy "insígnias são públicas" on public.user_badges for select using (true);
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to anon, authenticated;
grant select, insert, update, delete on public.user_badges to service_role;

-- A notificação "Você ganhou a insígnia X" diz qual insígnia.
alter table public.notifications add column badge text;

-- Dar insígnia ----------------------------------------------------------------
-- Só os gatilhos chamam. Não repete: se já tem, não faz nada nem notifica.

create function private.award_badge(who uuid, key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_badges (profile_id, badge) values (who, key)
  on conflict do nothing;
  if found then
    insert into public.notifications (recipient_id, type, actor_id, target_type, target_id, badge)
    values (who, 'badge', null, 'profile', who, key);
  end if;
end $$;
revoke execute on function private.award_badge(uuid, text) from public, anon, authenticated;

-- Membro fundador: os 1.000 primeiros a escolher um @. O contador só sobe (uma
-- conta fundadora apagada não libera vaga) e a trava evita passar de 1.000
-- quando duas pessoas escolhem ao mesmo tempo.
create table private.founder_slots (id boolean primary key default true check (id), used integer not null default 0);
insert into private.founder_slots default values;

-- Trava por pessoa antes de contar: dois projetos (ou duas aceitas) ao mesmo
-- tempo não deixam o limite passar sem a insígnia.
create function private.lock_badges(who uuid) returns void
language sql security definer set search_path = '' as $$
  select pg_advisory_xact_lock(hashtext('devsync_badges'), hashtext(who::text))
$$;
revoke execute on function private.lock_badges(uuid) from public, anon, authenticated;

create function private.badges_on_username() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.username is not null then
    return null; -- trocar de @ não conta como chegar agora
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
create trigger profiles_badges_username after insert or update of username on public.profiles
  for each row when (new.username is not null)
  execute function private.badges_on_username();

create function private.badges_on_followers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.id, 'popular');
  return null;
end $$;
create trigger profiles_badges_followers after update of followers_count on public.profiles
  for each row when (new.followers_count >= 50)
  execute function private.badges_on_followers();

create function private.badges_on_project() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
begin
  perform private.lock_badges(new.author_id);
  total := (select count(*) from public.projects where author_id = new.author_id);
  perform private.award_badge(new.author_id, 'first_project');
  if total >= 5 then
    perform private.award_badge(new.author_id, 'builder');
  end if;
  return null;
end $$;
create trigger projects_badges after insert on public.projects
  for each row execute function private.badges_on_project();

create function private.badges_on_question() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.author_id, 'curious');
  return null;
end $$;
create trigger questions_badges after insert on public.questions
  for each row execute function private.badges_on_question();

-- Respostas aceitas em perguntas de outra pessoa. Aceitar a própria não conta.
create function private.accepted_count(who uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.questions q
  join public.answers a on a.id = q.accepted_answer_id
  where a.author_id = who and q.author_id <> who
$$;
revoke execute on function private.accepted_count(uuid) from public, anon, authenticated;

create function private.badges_on_accepted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  answerer uuid := (select author_id from public.answers where id = new.accepted_answer_id);
  total integer;
begin
  if answerer is null or answerer = new.author_id then
    return null;
  end if;
  perform private.lock_badges(answerer);
  total := private.accepted_count(answerer);
  perform private.award_badge(answerer, 'first_accepted');
  if total >= 10 then
    perform private.award_badge(answerer, 'mentor');
  end if;
  return null;
end $$;
create trigger questions_badges_accepted after update of accepted_answer_id on public.questions
  for each row when (new.accepted_answer_id is not null and old.accepted_answer_id is distinct from new.accepted_answer_id)
  execute function private.badges_on_accepted();

revoke execute on function
  private.badges_on_username(), private.badges_on_followers(), private.badges_on_project(),
  private.badges_on_question(), private.badges_on_accepted()
  from public, anon, authenticated;

-- Exibir insígnias e usar borda ----------------------------------------------

alter table public.profiles
  add column shown_badges text[] not null default '{}'
  constraint profiles_shown_badges_max check (cardinality(shown_badges) <= 3);

grant update (shown_badges) on public.profiles to authenticated;

-- Recusa insígnia não conquistada (ou repetida) e borda ainda bloqueada.
create function private.profiles_check_badges() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  needed text := public.frame_required_badge(new.avatar_frame);
begin
  if new.shown_badges is distinct from old.shown_badges then
    if cardinality(new.shown_badges) <> (select count(distinct b) from unnest(new.shown_badges) b)
       or exists (
         select 1 from unnest(new.shown_badges) b
         where not exists (select 1 from public.user_badges u where u.profile_id = new.id and u.badge = b)) then
      raise exception 'Você só pode exibir insígnias que conquistou, sem repetir' using errcode = 'DS004';
    end if;
  end if;
  if new.avatar_frame is distinct from old.avatar_frame and needed is not null
     and not exists (select 1 from public.user_badges u where u.profile_id = new.id and u.badge = needed) then
    raise exception 'Essa borda ainda está bloqueada' using errcode = 'DS005';
  end if;
  return new;
end $$;
revoke execute on function private.profiles_check_badges() from public, anon, authenticated;

create trigger profiles_check_badges before update of shown_badges, avatar_frame on public.profiles
  for each row execute function private.profiles_check_badges();

-- Backfill: quem já cumpre as regras hoje ganha sem notificação -------------

-- Não guardamos quando cada um escolheu o @: a ordem de cadastro é a melhor aproximação.
insert into public.user_badges (profile_id, badge, awarded_at)
select id, 'founder', created_at from public.profiles
where username is not null
order by created_at, id
limit 1000
on conflict do nothing;
update private.founder_slots set used = (select count(*) from public.user_badges where badge = 'founder');

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'first_project', min(created_at) from public.projects group by author_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'builder', max(created_at) from public.projects group by author_id having count(*) >= 5
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'curious', min(created_at) from public.questions group by author_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select a.author_id, 'first_accepted', now()
from public.questions q join public.answers a on a.id = q.accepted_answer_id
where q.author_id <> a.author_id
group by a.author_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select a.author_id, 'mentor', now()
from public.questions q join public.answers a on a.id = q.accepted_answer_id
where q.author_id <> a.author_id
group by a.author_id having count(*) >= 10
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select id, 'popular', now() from public.profiles where followers_count >= 50
on conflict do nothing;

-- Permissões da API (PR #11): a função passa a conhecer user_badges e shown_badges.
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
  revoke all on public.user_badges from anon, authenticated;
  grant select on public.user_badges to anon, authenticated;
  revoke insert, update, delete on public.reports from anon;
  revoke insert, update, delete on public.reports from authenticated;
  grant insert (target_type, target_id, reason) on public.reports to authenticated;
  revoke insert, update, delete on public.blocked_domains from anon, authenticated;

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
    public.admin_resolve_target(public.report_target, uuid, public.report_status)
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
