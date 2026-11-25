-- Assuntos acompanhados (tag_follows) e tecnologias do perfil (profile_tags)
-- viram uma lista só: o que a pessoa escolhe no cadastro, na página da tag ou
-- no editor de perfil aparece marcado nos dois lugares.
-- Os gatilhos param sozinhos: "on conflict do nothing" e um delete sem linhas
-- não disparam o gatilho do outro lado de novo.

create or replace function private.sync_follow_to_profile_tag() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profile_tags (profile_id, tag_id) values (new.profile_id, new.tag_id)
    on conflict do nothing;
    return new;
  end if;
  delete from public.profile_tags where profile_id = old.profile_id and tag_id = old.tag_id;
  return old;
end $$;

create or replace function private.sync_profile_tag_to_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tag_follows (profile_id, tag_id) values (new.profile_id, new.tag_id)
    on conflict do nothing;
    return new;
  end if;
  delete from public.tag_follows where profile_id = old.profile_id and tag_id = old.tag_id;
  return old;
end $$;

revoke execute on function private.sync_follow_to_profile_tag(), private.sync_profile_tag_to_follow()
  from public, anon, authenticated;

create trigger tag_follows_sync_profile after insert or delete on public.tag_follows
  for each row execute function private.sync_follow_to_profile_tag();
create trigger profile_tags_sync_follow after insert or delete on public.profile_tags
  for each row execute function private.sync_profile_tag_to_follow();

-- Junta o que já existe (gatilhos acima ainda não viam essas linhas).
insert into public.profile_tags (profile_id, tag_id)
  select profile_id, tag_id from public.tag_follows on conflict do nothing;
insert into public.tag_follows (profile_id, tag_id)
  select profile_id, tag_id from public.profile_tags on conflict do nothing;
