-- Devsync: comentários (em projetos, perguntas e respostas, com 2 níveis),
-- visibilidade de conteúdo polimórfico e limpeza quando um alvo é apagado.

-- Visibilidade ----------------------------------------------------------------
-- Um conteúdo está visível para quem chama quando existe e não está oculto
-- pela moderação, ou quando quem chama é o autor ou admin. Para resposta e
-- comentário, o conteúdo "pai" também precisa estar visível.

create function public.content_is_visible(target_type text, target_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  admin boolean := public.is_admin();
  r record;
begin
  case target_type
    when 'project' then
      select author_id, hidden_at into r from public.projects where id = target_id;
      return found and (r.hidden_at is null or r.author_id = me or admin);
    when 'question' then
      select author_id, hidden_at into r from public.questions where id = target_id;
      return found and (r.hidden_at is null or r.author_id = me or admin);
    when 'answer' then
      select author_id, hidden_at, question_id into r from public.answers where id = target_id;
      return found and (r.author_id = me or admin
        or (r.hidden_at is null and public.content_is_visible('question', r.question_id)));
    when 'comment' then
      select author_id, hidden_at, c.target_type::text as tt, c.target_id as tid into r
        from public.comments c where id = content_is_visible.target_id;
      return found and (r.author_id = me or admin
        or (r.hidden_at is null and public.content_is_visible(r.tt, r.tid)));
    when 'demo' then
      return exists (select 1 from public.demos d where d.id = target_id
        and (d.status in ('live', 'unavailable') or d.owner_id = me or admin));
    when 'profile' then
      return exists (select 1 from public.profiles p where p.id = target_id);
    else
      return false;
  end case;
end $$;

-- Comentários -----------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type public.comment_target not null,
  target_id uuid not null,
  parent_id uuid references public.comments (id) on delete cascade,
  -- 0 = comentário, 1 = resposta a comentário. Nunca passa disso.
  depth smallint not null default 0 check (depth between 0 and 1),
  body_md text not null check (char_length(body_md) between 1 and 5000),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_target_idx on public.comments (target_type, target_id, created_at);
create index comments_parent_idx on public.comments (parent_id);
create index comments_author_idx on public.comments (author_id, created_at desc);

create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- Resposta a uma resposta é pendurada na raiz, para a conversa ter 2 níveis.
create function public.comments_set_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  parent public.comments;
begin
  if new.parent_id is null then
    new.depth := 0;
    return new;
  end if;
  select * into parent from public.comments where id = new.parent_id;
  if not found or parent.target_type <> new.target_type or parent.target_id <> new.target_id then
    raise exception 'O comentário pai precisa ser do mesmo conteúdo' using errcode = '23514';
  end if;
  new.parent_id := coalesce(parent.parent_id, parent.id);
  new.depth := 1;
  return new;
end $$;

create trigger comments_set_thread before insert on public.comments
  for each row execute function public.comments_set_thread();

create function public.comments_counter() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t public.comment_target := coalesce(new.target_type, old.target_type);
  tid uuid := coalesce(new.target_id, old.target_id);
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if t = 'project' then
    update public.projects set comments_count = greatest(comments_count + delta, 0) where id = tid;
  elsif t = 'question' then
    update public.questions set comments_count = greatest(comments_count + delta, 0) where id = tid;
  else
    update public.answers set comments_count = greatest(comments_count + delta, 0) where id = tid;
  end if;
  return null;
end $$;

create trigger comments_counter after insert or delete on public.comments
  for each row execute function public.comments_counter();

create trigger comments_revision after update of body_md on public.comments
  for each row execute function public.save_revision('comment');

alter table public.comments enable row level security;

create policy "comentários visíveis" on public.comments
  for select using (
    (hidden_at is null and public.content_is_visible(target_type::text, target_id))
    or author_id = auth.uid() or public.is_admin());
create policy "usuário ativo comenta conteúdo visível" on public.comments
  for insert to authenticated with check (
    author_id = auth.uid() and public.is_active_user()
    and public.content_is_visible(target_type::text, target_id));
create policy "autor edita comentário" on public.comments
  for update to authenticated
  using (author_id = auth.uid() and public.is_active_user()) with check (author_id = auth.uid());
create policy "autor apaga comentário" on public.comments
  for delete to authenticated using (author_id = auth.uid());

revoke insert, update, delete on public.comments from anon;
revoke insert, update on public.comments from authenticated;
grant insert (target_type, target_id, parent_id, body_md) on public.comments to authenticated;
grant update (body_md) on public.comments to authenticated;

-- Revisões: leitura pública quando o conteúdo de origem está visível ---------

create policy "revisões de conteúdo visível" on public.revisions
  for select using (public.content_is_visible(target_type::text, target_id));

-- Limpeza de alvos apagados ---------------------------------------------------
-- Comentários e revisões apontam para o alvo por (target_type, target_id), sem
-- FK. Este gatilho apaga o que ficaria órfão. TG_ARGV[0] é o tipo do alvo.

create function public.cleanup_target() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_argv[0] <> 'comment' then
    delete from public.comments where target_type = tg_argv[0]::public.comment_target and target_id = old.id;
  end if;
  delete from public.revisions where target_type = tg_argv[0]::public.revision_target and target_id = old.id;
  return null;
end $$;

create trigger projects_cleanup after delete on public.projects
  for each row execute function public.cleanup_target('project');
create trigger questions_cleanup after delete on public.questions
  for each row execute function public.cleanup_target('question');
create trigger answers_cleanup after delete on public.answers
  for each row execute function public.cleanup_target('answer');
create trigger comments_cleanup after delete on public.comments
  for each row execute function public.cleanup_target('comment');
