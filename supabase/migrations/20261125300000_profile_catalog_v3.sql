-- Devsync: catálogo animado do perfil (o dobro de tudo, todos os novos animados).
-- Banners 14 -> 28, cores 12 -> 24, bordas 18 -> 36, insígnias 15 -> 30.
-- Todo item novo é liberado por uma insígnia; os antigos continuam como estavam.
-- Espelha src/lib/social/profile-style.ts e src/lib/social/badges.ts: mudou aqui, muda lá.

-- Banners e cores --------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_banner_preset_check;
alter table public.profiles add constraint profiles_banner_preset_check check (banner_preset in (
  'aurora', 'circuito', 'grade', 'ondas', 'noite', 'hex',
  'terminal', 'constelacao', 'topografia', 'blueprint', 'crepusculo', 'oceano', 'prisma', 'nebulosa',
  'digitando', 'chuva_digital', 'sonar', 'batimento', 'cadentes', 'aurora_viva', 'equalizador',
  'sistema_solar', 'fluxo', 'particulas', 'varredura', 'mare', 'hiperespaco', 'mosaico'));

alter table public.profiles drop constraint if exists profiles_accent_check;
alter table public.profiles add constraint profiles_accent_check check (accent in (
  'azul', 'ciano', 'violeta', 'verde', 'ambar', 'rosa',
  'indigo', 'turquesa', 'lima', 'laranja', 'vermelho', 'grafite',
  'mar', 'boreal', 'neon', 'poente', 'plasma', 'glacial',
  'brasa', 'floresta', 'espectro', 'galaxia', 'ouro', 'retro'));

-- Insígnias --------------------------------------------------------------------

create or replace function public.badge_keys() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'founder',
    'first_project', 'builder', 'architect', 'loved',
    'curious', 'investigator', 'first_answer', 'helper', 'first_accepted', 'mentor', 'sage',
    'commenter', 'popular', 'influencer',
    'demo_live', 'prolific', 'star',
    'well_voted', 'reference', 'researcher', 'tireless', 'legend', 'reviewer',
    'first_follower', 'connected', 'supporter', 'fan', 'debater', 'icon']
$$;

-- O que libera cada item. Fora daqui, o item é livre para todos.

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
    when 'cometa' then 'first_follower'
    when 'radar' then 'curious'
    when 'respiracao' then 'first_answer'
    when 'tracejada' then 'first_accepted'
    when 'batida' then 'supporter'
    when 'ondas' then 'commenter'
    when 'arcos' then 'investigator'
    when 'brilho' then 'demo_live'
    when 'pendulo' then 'connected'
    when 'eletrons' then 'popular'
    when 'binario' then 'helper'
    when 'hexagono' then 'prolific'
    when 'glitch' then 'reviewer'
    when 'chama_viva' then 'star'
    when 'cintilante' then 'well_voted'
    when 'caleidoscopio' then 'influencer'
    when 'satelites' then 'tireless'
    when 'lendaria' then 'legend'
  end
$$;

create or replace function public.banner_required_badge(banner text) returns text
language sql immutable set search_path = '' as $$
  select case banner
    when 'digitando' then 'first_project'
    when 'chuva_digital' then 'builder'
    when 'sonar' then 'investigator'
    when 'batimento' then 'loved'
    when 'cadentes' then 'popular'
    when 'aurora_viva' then 'sage'
    when 'equalizador' then 'debater'
    when 'sistema_solar' then 'architect'
    when 'fluxo' then 'demo_live'
    when 'particulas' then 'fan'
    when 'varredura' then 'reviewer'
    when 'mare' then 'helper'
    when 'hiperespaco' then 'icon'
    when 'mosaico' then 'connected'
  end
$$;

create or replace function public.accent_required_badge(accent text) returns text
language sql immutable set search_path = '' as $$
  select case accent
    when 'mar' then 'first_follower'
    when 'boreal' then 'first_accepted'
    when 'neon' then 'commenter'
    when 'poente' then 'supporter'
    when 'plasma' then 'mentor'
    when 'glacial' then 'well_voted'
    when 'brasa' then 'star'
    when 'floresta' then 'builder'
    when 'espectro' then 'influencer'
    when 'galaxia' then 'researcher'
    when 'ouro' then 'reference'
    when 'retro' then 'founder'
  end
$$;

-- Recusa item bloqueado (borda, banner ou cor) com o mesmo código DS005.
create or replace function private.profiles_check_badges() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owns text[] := array(select u.badge from public.user_badges u where u.profile_id = new.id);
  frame_needed text := public.frame_required_badge(new.avatar_frame);
  banner_needed text := public.banner_required_badge(new.banner_preset);
  accent_needed text := public.accent_required_badge(new.accent);
begin
  if new.shown_badges is distinct from old.shown_badges then
    if cardinality(new.shown_badges) <> (select count(distinct b) from unnest(new.shown_badges) b)
       or exists (select 1 from unnest(new.shown_badges) b where not (b = any (owns))) then
      raise exception 'Você só pode exibir insígnias que conquistou, sem repetir' using errcode = 'DS004';
    end if;
  end if;
  if (new.avatar_frame is distinct from old.avatar_frame and frame_needed is not null and not (frame_needed = any (owns)))
     or (new.banner_preset is distinct from old.banner_preset and banner_needed is not null and not (banner_needed = any (owns)))
     or (new.accent is distinct from old.accent and accent_needed is not null and not (accent_needed = any (owns))) then
    raise exception 'Esse item ainda está bloqueado' using errcode = 'DS005';
  end if;
  return new;
end $$;
revoke execute on function private.profiles_check_badges() from public, anon, authenticated;

drop trigger if exists profiles_check_badges on public.profiles;
create trigger profiles_check_badges before update of shown_badges, avatar_frame, banner_preset, accent on public.profiles
  for each row execute function private.profiles_check_badges();

-- Gatilhos que já existiam ganham os níveis novos ------------------------------

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
  if total >= 30 then
    perform private.award_badge(new.author_id, 'prolific');
  end if;
  return null;
end $$;

create or replace function private.badges_on_project_likes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.author_id, 'loved');
  if new.likes_count >= 100 then
    perform private.award_badge(new.author_id, 'star');
  end if;
  return null;
end $$;

create or replace function private.badges_on_question() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
begin
  perform private.lock_badges(new.author_id);
  total := (select count(*) from public.questions where author_id = new.author_id);
  perform private.award_badge(new.author_id, 'curious');
  if total >= 10 then
    perform private.award_badge(new.author_id, 'investigator');
  end if;
  if total >= 50 then
    perform private.award_badge(new.author_id, 'researcher');
  end if;
  return null;
end $$;

create or replace function private.badges_on_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
begin
  perform private.lock_badges(new.author_id);
  total := (select count(*) from public.answers where author_id = new.author_id);
  perform private.award_badge(new.author_id, 'first_answer');
  if total >= 25 then
    perform private.award_badge(new.author_id, 'helper');
  end if;
  if total >= 100 then
    perform private.award_badge(new.author_id, 'tireless');
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
  if total >= 100 then
    perform private.award_badge(answerer, 'legend');
  end if;
  return null;
end $$;

create or replace function private.badges_on_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
begin
  perform private.lock_badges(new.author_id);
  total := (select count(*) from public.comments where author_id = new.author_id);
  if total >= 20 then
    perform private.award_badge(new.author_id, 'commenter');
  end if;
  if total >= 100 then
    perform private.award_badge(new.author_id, 'debater');
  end if;
  return null;
end $$;

-- Seguidores: agora conta desde o primeiro (antes o gatilho só acordava com 50).
create or replace function private.badges_on_followers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.id, 'first_follower');
  if new.followers_count >= 50 then
    perform private.award_badge(new.id, 'popular');
  end if;
  if new.followers_count >= 250 then
    perform private.award_badge(new.id, 'influencer');
  end if;
  if new.followers_count >= 1000 then
    perform private.award_badge(new.id, 'icon');
  end if;
  return null;
end $$;
drop trigger if exists profiles_badges_followers on public.profiles;
create trigger profiles_badges_followers after update of followers_count on public.profiles
  for each row when (new.followers_count >= 1 and new.followers_count > old.followers_count)
  execute function private.badges_on_followers();

-- Gatilhos novos -----------------------------------------------------------------

-- Seguir 10 pessoas.
create or replace function private.badges_on_following() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.id, 'connected');
  return null;
end $$;
drop trigger if exists profiles_badges_following on public.profiles;
create trigger profiles_badges_following after update of following_count on public.profiles
  for each row when (new.following_count >= 10)
  execute function private.badges_on_following();

-- Uma demo no ar (do zip ou link): a insígnia vai para quem é dono da demo.
create or replace function private.badges_on_demo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.owner_id, 'demo_live');
  return null;
end $$;
drop trigger if exists demos_badges on public.demos;
create trigger demos_badges after insert or update of status on public.demos
  for each row when (new.status = 'live')
  execute function private.badges_on_demo();

-- Uma resposta com 10 (e 50) votos positivos a mais que negativos.
create or replace function private.badges_on_answer_score() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.author_id, 'well_voted');
  if new.score >= 50 then
    perform private.award_badge(new.author_id, 'reference');
  end if;
  return null;
end $$;
drop trigger if exists answers_badges_score on public.answers;
create trigger answers_badges_score after update of score on public.answers
  for each row when (new.score >= 10)
  execute function private.badges_on_answer_score();

-- Curtir projetos de outras pessoas: 25 (apoiador) e 100 (fã).
create or replace function private.badges_on_like() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  total integer;
begin
  perform private.lock_badges(new.profile_id);
  total := (
    select count(*) from public.likes l join public.projects p on p.id = l.project_id
    where l.profile_id = new.profile_id and p.author_id <> new.profile_id);
  if total >= 25 then
    perform private.award_badge(new.profile_id, 'supporter');
  end if;
  if total >= 100 then
    perform private.award_badge(new.profile_id, 'fan');
  end if;
  return null;
end $$;
drop trigger if exists likes_badges on public.likes;
create trigger likes_badges after insert on public.likes
  for each row execute function private.badges_on_like();

-- Votar em 50 respostas de outras pessoas.
create or replace function private.badges_on_vote() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_badges(new.profile_id);
  if (select count(*) from public.answer_votes v join public.answers a on a.id = v.answer_id
      where v.profile_id = new.profile_id and a.author_id <> new.profile_id) >= 50 then
    perform private.award_badge(new.profile_id, 'reviewer');
  end if;
  return null;
end $$;
drop trigger if exists answer_votes_badges on public.answer_votes;
create trigger answer_votes_badges after insert on public.answer_votes
  for each row execute function private.badges_on_vote();

revoke execute on function
  private.badges_on_following(), private.badges_on_demo(), private.badges_on_answer_score(),
  private.badges_on_like(), private.badges_on_vote()
  from public, anon, authenticated;

-- Backfill: quem já cumpre as regras ganha sem notificação --------------------

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'prolific', max(created_at) from public.projects group by author_id having count(*) >= 30
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'star', now() from public.projects where likes_count >= 100 group by author_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select owner_id, 'demo_live', min(created_at) from public.demos where status = 'live' group by owner_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'well_voted', now() from public.answers where score >= 10 group by author_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'reference', now() from public.answers where score >= 50 group by author_id
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'researcher', max(created_at) from public.questions group by author_id having count(*) >= 50
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'tireless', max(created_at) from public.answers group by author_id having count(*) >= 100
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select a.author_id, 'legend', now()
from public.questions q join public.answers a on a.id = q.accepted_answer_id
where q.author_id <> a.author_id
group by a.author_id having count(*) >= 100
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select v.profile_id, 'reviewer', max(v.created_at)
from public.answer_votes v join public.answers a on a.id = v.answer_id
where a.author_id <> v.profile_id
group by v.profile_id having count(*) >= 50
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select id, 'first_follower', now() from public.profiles where followers_count >= 1
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select id, 'icon', now() from public.profiles where followers_count >= 1000
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select id, 'connected', now() from public.profiles where following_count >= 10
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select l.profile_id, 'supporter', max(l.created_at)
from public.likes l join public.projects p on p.id = l.project_id
where p.author_id <> l.profile_id
group by l.profile_id having count(*) >= 25
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select l.profile_id, 'fan', max(l.created_at)
from public.likes l join public.projects p on p.id = l.project_id
where p.author_id <> l.profile_id
group by l.profile_id having count(*) >= 100
on conflict do nothing;

insert into public.user_badges (profile_id, badge, awarded_at)
select author_id, 'debater', max(created_at) from public.comments group by author_id having count(*) >= 100
on conflict do nothing;
