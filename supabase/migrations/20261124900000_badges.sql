-- Devsync: insígnias conquistadas e bordas de avatar liberadas por conquista
-- (parte 2 do perfil personalizado, docs/superpowers/specs/2026-11-24-devsync-perfil-personalizado-design.md).
--
-- A conquista é gravada por gatilhos na hora em que acontece e é permanente:
-- apagar o conteúdo depois não tira a insígnia. Ninguém escreve em
-- user_badges pela API. O catálogo espelha src/lib/social/badges.ts.

-- A parte 1 (20261124500000_profile_customization) cria avatar_frame. O "if not
-- exists" só protege a ordem das migrations; não muda nada quando ela já rodou.
alter table public.profiles add column if not exists avatar_frame text;

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
revoke insert, update, delete, truncate on public.user_badges from anon, authenticated;
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

-- Membro fundador: os 1.000 primeiros a escolher um @. A trava evita passar de
-- 1.000 quando duas pessoas escolhem ao mesmo tempo.
create function private.badges_on_username() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.username is not null then
    return null; -- trocar de @ não conta como chegar agora
  end if;
  perform pg_advisory_xact_lock(hashtext('devsync_founder_badge'));
  if (select count(*) from public.user_badges where badge = 'founder') < 1000 then
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
  total integer := (select count(*) from public.projects where author_id = new.author_id);
begin
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

insert into public.user_badges (profile_id, badge, awarded_at)
select id, 'founder', created_at from public.profiles
where username is not null
order by created_at, id
limit 1000
on conflict do nothing;

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
