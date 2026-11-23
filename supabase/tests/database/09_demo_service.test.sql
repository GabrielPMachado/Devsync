begin;
\ir ../helpers.psql
select plan(7);

select tests.create_user('ana@x.dev', 'ana') as ana \gset

create function tests.demo_notes(who uuid) returns int language sql security definer set search_path = '' as $$
  select count(*)::int from public.notifications where recipient_id = who and type::text = 'demo_unavailable'
$$;
grant execute on function tests.demo_notes(uuid) to authenticated;

select has_column('public', 'demos', 'rejection_reason', 'demos has rejection_reason');

select tests.login_as(:'ana');
insert into demos (kind, url) values ('web_link', 'https://ana.dev') returning id as link \gset
insert into demos (kind) values ('web_upload') returning id as up \gset
insert into demos (kind, url) values ('web_link', 'https://solta.dev') returning id as solta \gset
insert into projects (title, demo_id) values ('Com link', :'link');
insert into projects (title, demo_id) values ('Com zip', :'up');

select throws_ok(
  format('update demos set rejection_reason = %L where id = %L', 'x', :'up'),
  '42501', null, 'user cannot write rejection_reason');

-- O serviço de demos grava com service_role.
reset role;
grant usage on schema tests to service_role;
grant execute on function tests.demo_notes(uuid) to service_role;
grant select on public.notifications to service_role;
set local role service_role;
update demos set status = 'unavailable' where id = :'link';
select is(tests.demo_notes(:'ana'), 0, 'pending -> unavailable does not notify');

update demos set status = 'live' where id = :'link';
update demos set status = 'unavailable' where id = :'link';
select is(tests.demo_notes(:'ana'), 1, 'live -> unavailable notifies the project author');
select is(
  (select target_type::text from notifications where recipient_id = :'ana' and type = 'demo_unavailable'),
  'project', 'notification targets the project');

update demos set status = 'live' where id = :'up';
update demos set status = 'unavailable', rejection_reason = 'unsafe_path' where id = :'up';
select is(tests.demo_notes(:'ana'), 1, 'web_upload does not notify');

update demos set status = 'live' where id = :'solta';
update demos set status = 'unavailable' where id = :'solta';
select is(tests.demo_notes(:'ana'), 1, 'demo without project does not notify');

select * from finish();
rollback;
