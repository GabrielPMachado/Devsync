-- Devsync: apoio ao serviço de demos (Cloudflare Worker).

-- Motivo de um zip recusado (ex.: 'unsafe_path', 'no_index'). Escrito só pelo
-- serviço de demos (service_role); o site mostra a mensagem ao autor.
alter table public.demos add column rejection_reason text;

-- Aviso ao autor quando o link da demo passa a bloquear embed.
alter type public.notification_type add value if not exists 'demo_unavailable';

create function public.demos_notify_unavailable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p record;
begin
  if new.kind = 'web_link' and old.status = 'live' and new.status = 'unavailable' then
    for p in select id, author_id from public.projects where demo_id = new.id loop
      perform public.notify(p.author_id, 'demo_unavailable'::public.notification_type, null, 'project', p.id);
    end loop;
  end if;
  return new;
end $$;

revoke execute on function public.demos_notify_unavailable() from public, anon, authenticated;

create trigger demos_notify_unavailable after update of status on public.demos
  for each row execute function public.demos_notify_unavailable();
