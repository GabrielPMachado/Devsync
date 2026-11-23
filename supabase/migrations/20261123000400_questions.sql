-- Devsync: estudos (perguntas e respostas), votos, "não funciona mais",
-- "precisa de mais detalhes" e o gatilho de revisões.
-- Regras da seção 5.4 da spec. A ordem das respostas fica em answers_ordered.

-- Perguntas -------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 10 and 150),
  slug text not null unique,
  body_md text not null check (char_length(body_md) between 1 and 30000),
  project_id uuid references public.projects (id) on delete set null,
  accepted_answer_id uuid, -- FK criada depois de answers
  -- "Veja também": pergunta repetida não é fechada, aponta para a original.
  duplicate_of_id uuid references public.questions (id) on delete set null,
  lang text not null default 'pt-BR',
  answers_count integer not null default 0,
  comments_count integer not null default 0,
  detail_requests_count integer not null default 0,
  hidden_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('portuguese', title), 'A')
    || setweight(to_tsvector('portuguese', body_md), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_author_idx on public.questions (author_id, created_at desc);
create index questions_created_idx on public.questions (created_at desc);
create index questions_unanswered_idx on public.questions (created_at desc) where answers_count = 0;
create index questions_search_idx on public.questions using gin (search);
create index questions_project_idx on public.questions (project_id);
create index questions_duplicate_of_idx on public.questions (duplicate_of_id);
create index questions_accepted_answer_idx on public.questions (accepted_answer_id);

create trigger questions_set_slug before insert on public.questions
  for each row execute function public.set_slug();
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

alter table public.questions enable row level security;

create policy "perguntas visíveis" on public.questions
  for select using (hidden_at is null or author_id = (select auth.uid()) or (select public.is_admin()));
create policy "usuário ativo pergunta" on public.questions
  for insert to authenticated with check (author_id = (select auth.uid()) and (select public.is_active_user()));
create policy "autor edita pergunta" on public.questions
  for update to authenticated
  using (author_id = (select auth.uid()) and (select public.is_active_user())) with check (author_id = (select auth.uid()));
create policy "autor apaga pergunta" on public.questions
  for delete to authenticated using (author_id = (select auth.uid()));

revoke insert, update, delete on public.questions from anon;
revoke insert, update on public.questions from authenticated;
grant insert (title, body_md, project_id, lang) on public.questions to authenticated;
grant update (title, body_md, project_id, accepted_answer_id, lang) on public.questions to authenticated;

-- Tags da pergunta (1 a 5; o mínimo de 1 é conferido pelo site) ---------------

create table public.question_tags (
  question_id uuid not null references public.questions (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (question_id, tag_id)
);
create index question_tags_tag_idx on public.question_tags (tag_id, question_id);

create trigger question_tags_max before insert on public.question_tags
  for each row execute function public.enforce_max_tags();

alter table public.question_tags enable row level security;

create policy "tags de pergunta visíveis" on public.question_tags
  for select using (exists (select 1 from public.questions q where q.id = question_id));
create policy "autor marca tags da pergunta" on public.question_tags
  for insert to authenticated with check (
    (select public.is_active_user())
    and exists (select 1 from public.questions q where q.id = question_id and q.author_id = (select auth.uid())));
create policy "autor desmarca tags da pergunta" on public.question_tags
  for delete to authenticated using (
    exists (select 1 from public.questions q where q.id = question_id and q.author_id = (select auth.uid())));

revoke insert, update, delete on public.question_tags from anon;
revoke update on public.question_tags from authenticated;

-- Respostas -------------------------------------------------------------------

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body_md text not null check (char_length(body_md) between 1 and 30000),
  demo_id uuid references public.demos (id) on delete set null,
  tech_version text check (char_length(tech_version) <= 40),
  lang text not null default 'pt-BR',
  -- Positivos menos negativos. Nunca exibido em destaque quando negativo.
  score integer not null default 0,
  -- Quantas pessoas marcaram "não funciona mais" (zera ao editar o corpo).
  outdated_flags integer not null default 0,
  comments_count integer not null default 0,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index answers_question_idx on public.answers (question_id, score desc, created_at desc);
create index answers_author_idx on public.answers (author_id, created_at desc);
create index answers_demo_idx on public.answers (demo_id);

alter table public.questions
  add constraint questions_accepted_answer_fk
  foreign key (accepted_answer_id) references public.answers (id) on delete set null;

create trigger answers_updated_at before update on public.answers
  for each row execute function public.set_updated_at();
create trigger answers_check_demo_owner before insert or update of demo_id on public.answers
  for each row execute function public.projects_check_demo_owner();

-- Resposta aceita precisa ser da mesma pergunta.
create function public.questions_check_accepted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.accepted_answer_id is not null and not exists (
    select 1 from public.answers where id = new.accepted_answer_id and question_id = new.id) then
    raise exception 'A resposta aceita precisa ser desta pergunta' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger questions_check_accepted before update of accepted_answer_id on public.questions
  for each row execute function public.questions_check_accepted();

create function public.answers_counter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.questions set answers_count = answers_count + 1 where id = new.question_id;
  else
    update public.questions set answers_count = greatest(answers_count - 1, 0) where id = old.question_id;
  end if;
  return null;
end $$;

create trigger answers_counter after insert or delete on public.answers
  for each row execute function public.answers_counter();

alter table public.answers enable row level security;

create policy "respostas visíveis" on public.answers
  for select using (
    (hidden_at is null and exists (select 1 from public.questions q where q.id = question_id))
    or author_id = (select auth.uid()) or (select public.is_admin()));
create policy "usuário ativo responde pergunta visível" on public.answers
  for insert to authenticated with check (
    author_id = (select auth.uid()) and (select public.is_active_user())
    and exists (select 1 from public.questions q where q.id = question_id and q.hidden_at is null));
create policy "autor edita resposta" on public.answers
  for update to authenticated
  using (author_id = (select auth.uid()) and (select public.is_active_user())) with check (author_id = (select auth.uid()));
create policy "autor apaga resposta" on public.answers
  for delete to authenticated using (author_id = (select auth.uid()));

revoke insert, update, delete on public.answers from anon;
revoke insert, update on public.answers from authenticated;
grant insert (question_id, body_md, demo_id, tech_version, lang) on public.answers to authenticated;
grant update (body_md, demo_id, tech_version) on public.answers to authenticated;

-- Votos em respostas (pergunta não recebe voto) -------------------------------

create table public.answer_votes (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  answer_id uuid not null references public.answers (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (profile_id, answer_id)
);
create index answer_votes_answer_idx on public.answer_votes (answer_id);

create function public.answer_votes_score() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.answers set score = score + new.value where id = new.answer_id;
  elsif tg_op = 'UPDATE' then
    update public.answers set score = score - old.value + new.value where id = new.answer_id;
  else
    update public.answers set score = score - old.value where id = old.answer_id;
  end if;
  return null;
end $$;

create trigger answer_votes_score after insert or update of value or delete on public.answer_votes
  for each row execute function public.answer_votes_score();

alter table public.answer_votes enable row level security;

create policy "cada um vê os próprios votos" on public.answer_votes
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "usuário ativo vota em resposta alheia" on public.answer_votes
  for insert to authenticated with check (
    profile_id = (select auth.uid()) and (select public.is_active_user())
    and exists (select 1 from public.answers a
                where a.id = answer_id and a.author_id <> (select auth.uid()) and a.hidden_at is null));
create policy "cada um troca o próprio voto" on public.answer_votes
  for update to authenticated
  using (profile_id = (select auth.uid()) and (select public.is_active_user())) with check (profile_id = (select auth.uid()));
create policy "cada um retira o próprio voto" on public.answer_votes
  for delete to authenticated using (profile_id = (select auth.uid()));

revoke insert, update, delete on public.answer_votes from anon;
revoke insert, update on public.answer_votes from authenticated;
grant insert (answer_id, value) on public.answer_votes to authenticated;
grant update (value) on public.answer_votes to authenticated;

-- "Não funciona mais" ---------------------------------------------------------

create table public.outdated_flags (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  answer_id uuid not null references public.answers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, answer_id)
);
create index outdated_flags_answer_idx on public.outdated_flags (answer_id);

create function public.outdated_flags_counter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.answers set outdated_flags = outdated_flags + 1 where id = new.answer_id;
  else
    update public.answers set outdated_flags = greatest(outdated_flags - 1, 0) where id = old.answer_id;
  end if;
  return null;
end $$;

create trigger outdated_flags_counter after insert or delete on public.outdated_flags
  for each row execute function public.outdated_flags_counter();

-- Editar o corpo da resposta zera as marcações (a resposta foi corrigida).
create function public.answers_reset_flags() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.outdated_flags where answer_id = new.id;
  update public.answers set outdated_flags = 0 where id = new.id and outdated_flags <> 0;
  return null;
end $$;

create trigger answers_reset_flags after update of body_md on public.answers
  for each row when (old.body_md is distinct from new.body_md)
  execute function public.answers_reset_flags();

alter table public.outdated_flags enable row level security;

create policy "cada um vê as próprias marcações" on public.outdated_flags
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "usuário ativo marca resposta alheia" on public.outdated_flags
  for insert to authenticated with check (
    profile_id = (select auth.uid()) and (select public.is_active_user())
    and exists (select 1 from public.answers a where a.id = answer_id and a.author_id <> (select auth.uid())));
create policy "cada um desmarca" on public.outdated_flags
  for delete to authenticated using (profile_id = (select auth.uid()));

revoke insert, update, delete on public.outdated_flags from anon;
revoke insert, update on public.outdated_flags from authenticated;
grant insert (answer_id) on public.outdated_flags to authenticated;

-- "Precisa de mais detalhes" (substitui o voto negativo na pergunta) ---------

create table public.detail_requests (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, question_id)
);
create index detail_requests_question_idx on public.detail_requests (question_id);

create function public.detail_requests_counter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.questions set detail_requests_count = detail_requests_count + 1 where id = new.question_id;
  else
    update public.questions set detail_requests_count = greatest(detail_requests_count - 1, 0) where id = old.question_id;
  end if;
  return null;
end $$;

create trigger detail_requests_counter after insert or delete on public.detail_requests
  for each row execute function public.detail_requests_counter();

alter table public.detail_requests enable row level security;

create policy "cada um vê os próprios pedidos" on public.detail_requests
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "usuário ativo pede detalhes em pergunta alheia" on public.detail_requests
  for insert to authenticated with check (
    profile_id = (select auth.uid()) and (select public.is_active_user())
    and exists (select 1 from public.questions q where q.id = question_id and q.author_id <> (select auth.uid())));
create policy "cada um retira o pedido" on public.detail_requests
  for delete to authenticated using (profile_id = (select auth.uid()));

revoke insert, update, delete on public.detail_requests from anon;
revoke insert, update on public.detail_requests from authenticated;
grant insert (question_id) on public.detail_requests to authenticated;

-- Revisões (histórico de edição) ----------------------------------------------
-- Grava a versão anterior quando título ou corpo mudam. TG_ARGV[0] é o tipo.

create function public.save_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  body_col text := case when tg_argv[0] = 'project' then 'description_md' else 'body_md' end;
begin
  if (o ->> body_col) is distinct from (n ->> body_col)
     or (o ->> 'title') is distinct from (n ->> 'title') then
    insert into public.revisions (target_type, target_id, editor_id, title, body_md)
    values (tg_argv[0]::public.revision_target, old.id, auth.uid(), o ->> 'title', o ->> body_col);
  end if;
  return null;
end $$;

create trigger projects_revision after update of title, description_md on public.projects
  for each row execute function public.save_revision('project');
create trigger questions_revision after update of title, body_md on public.questions
  for each row execute function public.save_revision('question');
create trigger answers_revision after update of body_md on public.answers
  for each row execute function public.save_revision('answer');
