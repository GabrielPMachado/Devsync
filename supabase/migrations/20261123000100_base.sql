-- Devsync: base do schema.
-- Extensões, enums compartilhados, a tabela de revisões e funções auxiliares.
-- Regras gerais de todo o schema:
--   * toda tabela em public tem RLS ligada e políticas explícitas;
--   * o usuário só escreve as colunas que recebem GRANT de coluna; contadores,
--     papéis e campos de moderação são escritos por gatilhos ou RPCs de admin;
--   * funções security definer usam search_path vazio e nomes qualificados.

create extension if not exists unaccent with schema extensions;

-- Enums -----------------------------------------------------------------------

create type public.user_role as enum ('user', 'admin');

-- Fixados pelo roteiro da fase 1 (contrato com o serviço de demos).
create type public.demo_kind as enum ('web_link', 'web_upload', 'sandbox', 'mobile');
create type public.demo_status as enum ('pending', 'live', 'blocked', 'unavailable');

create type public.comment_target as enum ('project', 'question', 'answer');
create type public.revision_target as enum ('project', 'question', 'answer', 'comment');
create type public.report_target as enum ('project', 'question', 'answer', 'comment', 'demo', 'profile');
create type public.report_status as enum ('open', 'dismissed', 'actioned');
create type public.notification_type as enum
  ('follow', 'comment', 'reply', 'answer', 'accepted', 'like', 'vote', 'detail_request');
create type public.notification_target as enum ('profile', 'project', 'question', 'answer', 'comment');

-- Funções auxiliares ----------------------------------------------------------

-- Mantém updated_at em dia nas tabelas editáveis.
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- "Olá, Mundo!" -> "ola-mundo". Usado para gerar slugs de URL.
create function public.slugify(value text) returns text
language sql stable set search_path = '' as $$
  select trim(both '-' from left(
    trim(both '-' from regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''))),
      '[^a-z0-9]+', '-', 'g')),
    60))
$$;

-- Revisões --------------------------------------------------------------------
-- Guarda a versão ANTERIOR de cada edição (só o autor edita o próprio conteúdo).
-- Escrita só por gatilho (save_revision, criado junto das perguntas). Leitura
-- liberada quando o conteúdo de origem está visível (política criada depois
-- de content_is_visible).

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  target_type public.revision_target not null,
  target_id uuid not null,
  editor_id uuid,
  title text,
  body_md text,
  created_at timestamptz not null default now()
);

create index revisions_target_idx on public.revisions (target_type, target_id, created_at desc);

alter table public.revisions enable row level security;
revoke insert, update, delete on public.revisions from anon, authenticated;
