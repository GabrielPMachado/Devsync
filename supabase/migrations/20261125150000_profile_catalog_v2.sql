-- Devsync: catálogo maior de personalização do perfil.
-- Banners 6 -> 14, cores 6 -> 12, bordas 7 -> 18 (9 por conquista), insígnias 7 -> 15.
-- Espelha src/lib/social/profile-style.ts e src/lib/social/badges.ts: mudou aqui, muda lá.

-- Banners e cores --------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_banner_preset_check;
alter table public.profiles add constraint profiles_banner_preset_check check (banner_preset in (
  'aurora', 'circuito', 'grade', 'ondas', 'noite', 'hex',
  'terminal', 'constelacao', 'topografia', 'blueprint', 'crepusculo', 'oceano', 'prisma', 'nebulosa'));

alter table public.profiles drop constraint if exists profiles_accent_check;
alter table public.profiles add constraint profiles_accent_check check (accent in (
  'azul', 'ciano', 'violeta', 'verde', 'ambar', 'rosa',
  'indigo', 'turquesa', 'lima', 'laranja', 'vermelho', 'grafite'));

-- Insígnias --------------------------------------------------------------------

create or replace function public.badge_keys() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'founder',
    'first_project', 'builder', 'architect', 'loved',
    'curious', 'investigator', 'first_answer', 'helper', 'first_accepted', 'mentor', 'sage',
    'commenter', 'popular', 'influencer']
$$;

create or replace function public.frame_required_badge(frame text) returns text
language sql immutable set search_path = '' as $$
  select case frame
    when 'neon' then 'mentor'
    when 'colchetes' then 'builder'
    when 'dourada' then 'founder'
    when 'orbita' then 'first_project'
    when 'circuito' then 'architect'
    when 'chama' then 'loved'
    when 'pulso' then 'helper'
    when 'aurora' then 'sage'
    when 'prisma' then 'influencer'
  end
$$;

-- Gatilhos que já existiam passam a dar as insígnias novas do mesmo assunto.

create or replace function private.badges_on_followers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.id, 'popular');
  if new.followers_count >= 250 then
    perform private.award_badge(new.id, 'influencer');
  end if;
  return null;
end $$;

create or replace function private.badges_on_project() returns trigger
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
  if total >= 15 then
    perform private.award_badge(new.author_id, 'architect');
  end if;
  return null;
end $$;

create or replace function private.badges_on_question() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_badges(new.author_id);
  perform private.award_badge(new.author_id, 'curious');
  if (select count(*) from public.questions where author_id = new.author_id) >= 10 then
    perform private.award_badge(new.author_id, 'investigator');
  end if;
  return null;
end $$;

create or replace function private.badges_on_accepted() returns trigger
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
  if total >= 50 then
    perform private.award_badge(answerer, 'sage');
  end if;
  return null;
end $$;

-- Gatilhos novos.

create function private.badges_on_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_badges(new.author_id);
  perform private.award_badge(new.author_id, 'first_answer');
  if (select count(*) from public.answers where author_id = new.author_id) >= 25 then
    perform private.award_badge(new.author_id, 'helper');
  end if;
  return null;
end $$;
create trigger answers_badges after insert on public.answers
  for each row execute function private.badges_on_answer();

create function private.badges_on_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_badges(new.author_id);
  if (select count(*) from public.comments where author_id = new.author_id) >= 20 then
    perform private.award_badge(new.author_id, 'commenter');
  end if;
  return null;
end $$;
create trigger comments_badges after insert on public.comments
  for each row execute function private.badges_on_comment();

-- Um projeto com 25 curtidas: a insígnia vai para quem o publicou.
create function private.badges_on_project_likes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.author_id, 'loved');
  return null;
end $$;
create trigger projects_badges_likes after update of likes_count on public.projects
  for each row when (new.likes_count >= 25)
  execute function private.badges_on_project_likes();

revoke execute on function
  private.badges_on_answer(), private.badges_on_comment(), private.badges_on_project_likes()
  from public, anon, authenticated;

-- Backfill: quem já cumpre as regras ganha sem notificação --------------------

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'architect', max(created_at) from public.projects group by author_id having count(*) >= 15
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'loved', now() from public.projects where likes_count >= 25 group by author_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'investigator', max(created_at) from public.questions group by author_id having count(*) >= 10
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'first_answer', min(created_at) from public.answers group by author_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'helper', max(created_at) from public.answers group by author_id having count(*) >= 25
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select a.author_id, 'sage', now()
from public.questions q join public.answers a on a.id = q.accepted_answer_id
where q.author_id <> a.author_id
group by a.author_id having count(*) >= 50
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'commenter', max(created_at) from public.comments group by author_id having count(*) >= 20
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select id, 'influencer', now() from public.profiles where followers_count >= 250
on conflict do nothing;
