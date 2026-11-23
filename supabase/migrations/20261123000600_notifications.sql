-- Devsync: notificações, denúncias e ações de moderação.

-- Notificações ----------------------------------------------------------------
-- Uma linha por evento. O agrupamento ("Ana e mais 4 curtiram") é feito na
-- leitura. Só gatilhos escrevem; o destinatário lê, marca como lida e apaga.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles (id) on delete cascade,
  target_type public.notification_target not null,
  target_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_target_idx on public.notifications (target_id);
create index notifications_actor_idx on public.notifications (actor_id);

alter table public.notifications enable row level security;

create policy "cada um vê as próprias notificações" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy "cada um marca as próprias como lidas" on public.notifications
  for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy "cada um apaga as próprias" on public.notifications
  for delete to authenticated using (recipient_id = (select auth.uid()));

revoke insert, update, delete on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Tempo real (Supabase Realtime respeita a RLS acima).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Uso interno dos gatilhos. Ninguém da API pode chamar (senão daria para
-- forjar notificações).
create function public.notify(
  recipient_id uuid, kind public.notification_type, actor_id uuid,
  target_type public.notification_target, target_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if notify.recipient_id is not null and notify.recipient_id is distinct from notify.actor_id then
    insert into public.notifications (recipient_id, type, actor_id, target_type, target_id)
    values (notify.recipient_id, notify.kind, notify.actor_id, notify.target_type, notify.target_id);
  end if;
end $$;

revoke execute on function public.notify(uuid, public.notification_type, uuid, public.notification_target, uuid)
  from public, anon, authenticated;

-- Desfazer a ação (descurtir, retirar voto, deixar de seguir) apaga a
-- notificação ainda não lida.
create function public.unnotify(
  recipient_id uuid, kind public.notification_type, actor_id uuid, target_id uuid
) returns void
language sql security definer set search_path = '' as $$
  delete from public.notifications n
  where n.recipient_id = unnotify.recipient_id and n.type = unnotify.kind
    and n.actor_id = unnotify.actor_id and n.target_id = unnotify.target_id
    and n.read_at is null
$$;

revoke execute on function public.unnotify(uuid, public.notification_type, uuid, uuid)
  from public, anon, authenticated;

-- Gatilhos de notificação -----------------------------------------------------

create function public.notify_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.followee_id, 'follow', new.follower_id, 'profile', new.follower_id);
  else
    perform public.unnotify(old.followee_id, 'follow', old.follower_id, old.follower_id);
  end if;
  return null;
end $$;

create trigger follows_notify after insert or delete on public.follows
  for each row execute function public.notify_follow();

create function public.notify_like() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  author uuid;
begin
  select author_id into author from public.projects where id = coalesce(new.project_id, old.project_id);
  if tg_op = 'INSERT' then
    perform public.notify(author, 'like', new.profile_id, 'project', new.project_id);
  else
    perform public.unnotify(author, 'like', old.profile_id, old.project_id);
  end if;
  return null;
end $$;

create trigger likes_notify after insert or delete on public.likes
  for each row execute function public.notify_like();

-- Só voto positivo notifica. Virar -1 ou retirar apaga a notificação.
create function public.notify_vote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  author uuid;
begin
  select author_id into author from public.answers where id = coalesce(new.answer_id, old.answer_id);
  if tg_op in ('UPDATE', 'DELETE') and old.value = 1 then
    perform public.unnotify(author, 'vote', old.profile_id, old.answer_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.value = 1 then
    perform public.notify(author, 'vote', new.profile_id, 'answer', new.answer_id);
  end if;
  return null;
end $$;

create trigger answer_votes_notify after insert or update of value or delete on public.answer_votes
  for each row execute function public.notify_vote();

create function public.notify_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(
    (select author_id from public.questions where id = new.question_id),
    'answer', new.author_id, 'answer', new.id);
  return null;
end $$;

create trigger answers_notify after insert on public.answers
  for each row execute function public.notify_answer();

create function public.notify_accepted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.accepted_answer_id is not null then
    perform public.notify(
      (select author_id from public.answers where id = new.accepted_answer_id),
      'accepted', new.author_id, 'answer', new.accepted_answer_id);
  end if;
  return null;
end $$;

create trigger questions_notify_accepted after update of accepted_answer_id on public.questions
  for each row when (old.accepted_answer_id is distinct from new.accepted_answer_id)
  execute function public.notify_accepted();

create function public.notify_detail_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(
    (select author_id from public.questions where id = new.question_id),
    'detail_request', new.profile_id, 'question', new.question_id);
  return null;
end $$;

create trigger detail_requests_notify after insert on public.detail_requests
  for each row execute function public.notify_detail_request();

-- Comentário notifica o autor do conteúdo; resposta a comentário notifica
-- também o autor do comentário pai (uma vez só, se for a mesma pessoa).
create function public.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target_author uuid;
  parent_author uuid;
begin
  target_author := case new.target_type
    when 'project' then (select author_id from public.projects where id = new.target_id)
    when 'question' then (select author_id from public.questions where id = new.target_id)
    else (select author_id from public.answers where id = new.target_id)
  end;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    perform public.notify(parent_author, 'reply', new.author_id, 'comment', new.id);
  end if;
  if target_author is distinct from parent_author then
    perform public.notify(target_author, 'comment', new.author_id, 'comment', new.id);
  end if;
  return null;
end $$;

create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

-- Limpeza: alvo apagado leva as notificações junto ----------------------------

create or replace function public.cleanup_target() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_argv[0] <> 'comment' then
    delete from public.comments where target_type = tg_argv[0]::public.comment_target and target_id = old.id;
  end if;
  delete from public.revisions where target_type = tg_argv[0]::public.revision_target and target_id = old.id;
  delete from public.notifications where target_id = old.id;
  return null;
end $$;

-- Denúncias -------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_open_idx on public.reports (created_at) where status = 'open';
create index reports_resolved_by_idx on public.reports (resolved_by);

alter table public.reports enable row level security;

create policy "quem denunciou e admins veem a denúncia" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy "usuário ativo denuncia conteúdo visível" on public.reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid()) and (select public.is_active_user())
    and public.content_is_visible(target_type::text, target_id));

revoke insert, update, delete on public.reports from anon;
revoke insert, update, delete on public.reports from authenticated;
grant insert (target_type, target_id, reason) on public.reports to authenticated;

-- Ações de admin (RPC) --------------------------------------------------------
-- Página /admin. Todas conferem is_admin() e rodam fora da RLS.

create function public.assert_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas admins' using errcode = '42501';
  end if;
end $$;

-- Oculta ou volta a mostrar projeto, pergunta, resposta ou comentário.
create function public.admin_set_hidden(target public.report_target, target_id uuid, hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ts timestamptz := case when hidden then now() end;
begin
  perform public.assert_admin();
  case target
    when 'project' then update public.projects set hidden_at = ts where id = admin_set_hidden.target_id;
    when 'question' then update public.questions set hidden_at = ts where id = admin_set_hidden.target_id;
    when 'answer' then update public.answers set hidden_at = ts where id = admin_set_hidden.target_id;
    when 'comment' then update public.comments set hidden_at = ts where id = admin_set_hidden.target_id;
    else raise exception 'Use admin_set_demo_status ou admin_suspend_profile' using errcode = '22023';
  end case;
end $$;

create function public.admin_suspend_profile(profile_id uuid, suspended boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.profiles set suspended_at = case when suspended then now() end
  where id = admin_suspend_profile.profile_id;
end $$;

-- blocked tira a demo do ar na hora (o Worker deixa de servir).
create function public.admin_set_demo_status(demo_id uuid, status public.demo_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.demos set status = admin_set_demo_status.status where id = admin_set_demo_status.demo_id;
end $$;

create function public.admin_resolve_report(report_id uuid, status public.report_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.reports
  set status = admin_resolve_report.status,
      resolved_by = case when admin_resolve_report.status = 'open' then null else auth.uid() end,
      resolved_at = case when admin_resolve_report.status = 'open' then null else now() end
  where id = admin_resolve_report.report_id;
end $$;

-- "Veja também": liga a pergunta repetida à original (null desfaz).
create function public.admin_mark_duplicate(question_id uuid, original_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if question_id = original_id then
    raise exception 'Uma pergunta não pode repetir ela mesma' using errcode = '22023';
  end if;
  update public.questions set duplicate_of_id = original_id where id = admin_mark_duplicate.question_id;
end $$;

revoke execute on function
  public.admin_set_hidden(public.report_target, uuid, boolean),
  public.admin_suspend_profile(uuid, boolean),
  public.admin_set_demo_status(uuid, public.demo_status),
  public.admin_resolve_report(uuid, public.report_status),
  public.admin_mark_duplicate(uuid, uuid)
  from public, anon;
