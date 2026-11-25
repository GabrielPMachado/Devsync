begin;
\ir ../helpers.psql
select plan(42);

-- Moderação de perfis e do catálogo (20261125400000_admin_profiles.sql).

select tests.create_user('adm@x.dev', 'chefe') as adm \gset
select tests.make_admin(:'adm');
select tests.create_user('lia@x.dev', 'lia') as lia \gset
select tests.create_user('rui@x.dev', 'rui') as rui \gset

create function tests.has_badge(who uuid, key text) returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from public.user_badges where profile_id = who and badge = key)
$$;
create function tests.profile(who uuid) returns public.profiles language sql security definer set search_path = '' as $$
  select * from public.profiles where id = who
$$;
create function tests.log_count(who uuid, act text) returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.admin_actions where profile_id is not distinct from who and action = act
$$;
create function tests.badge_notes(who uuid, key text) returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.notifications where recipient_id = who and badge = key
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Só admin --------------------------------------------------------------------------
select tests.login_as(:'lia');
select throws_ok(format($$ select public.admin_award_badge(%L, 'mentor') $$, :'rui'), '42501', null, 'membro não dá insígnia');
select throws_ok($$ select public.admin_set_catalog_item('banner', 'aurora', false) $$, '42501', null, 'membro não mexe no catálogo');
select throws_ok(format($$ select public.admin_update_profile(%L, '{"bio": "x"}') $$, :'rui'), '42501', null, 'membro não edita perfil alheio');
select throws_ok($$ select * from public.admin_find_profiles('') $$, '42501', null, 'membro não busca perfis');
select throws_ok($$ insert into public.catalog_item_state (kind, key, active) values ('banner', 'aurora', false) $$, '42501', null, 'sem escrita direta no catálogo');
select throws_ok(format($$ insert into public.profile_item_grants (profile_id, kind, key) values (%L, 'frame', 'neon') $$, :'lia'), '42501', null, 'sem escrita direta nas liberações');
select is((select count(*) from public.admin_actions), 0::bigint, 'membro não lê o registro');
reset role;

-- Dar e tirar insígnia ---------------------------------------------------------------
select tests.login_as(:'adm');
select lives_ok(format($$ select public.admin_award_badge(%L, 'mentor') $$, :'lia'), 'admin dá insígnia');
select ok(tests.has_badge(:'lia', 'mentor'), 'lia tem mentor');
select is(tests.badge_notes(:'lia', 'mentor'), 1::bigint, 'lia é avisada');
select lives_ok(format($$ select public.admin_award_badge(%L, 'sage', false) $$, :'lia'), 'admin dá sem avisar');
select is(tests.badge_notes(:'lia', 'sage'), 0::bigint, 'sem aviso quando pedido');
select throws_ok(format($$ select public.admin_award_badge(%L, 'inventada') $$, :'lia'), '22023', null, 'insígnia fora do catálogo falha');
select is(tests.log_count(:'lia', 'award_badge'), 2::bigint, 'as duas entram no registro');
reset role;

-- lia usa a borda neon (de mentor) e exibe a insígnia
select tests.login_as(:'lia');
select lives_ok($$ update profiles set avatar_frame = 'neon', shown_badges = '{mentor,sage}' where id = auth.uid() $$, 'lia usa a borda e exibe');
reset role;

select tests.login_as(:'adm');
select lives_ok(format($$ select public.admin_revoke_badge(%L, 'mentor') $$, :'lia'), 'admin tira insígnia');
select ok(not tests.has_badge(:'lia', 'mentor'), 'lia não tem mais mentor');
select is((tests.profile(:'lia')).shown_badges, '{sage}'::text[], 'sai das exibidas, a ordem das outras fica');
select is((tests.profile(:'lia')).avatar_frame, null, 'borda que dependia dela volta ao padrão');

-- Liberar borda à mão ------------------------------------------------------------------
select lives_ok(format($$ select public.admin_grant_item(%L, 'frame', 'prisma') $$, :'rui'), 'admin libera borda prisma para rui');
reset role;
select tests.login_as(:'rui');
select lives_ok($$ update profiles set avatar_frame = 'prisma' where id = auth.uid() $$, 'rui usa borda liberada sem a insígnia Influente');
reset role;
select tests.login_as(:'adm');
select lives_ok(format($$ select public.admin_revoke_item(%L, 'frame', 'prisma') $$, :'rui'), 'admin tira a liberação');
select is((tests.profile(:'rui')).avatar_frame, null, 'rui volta à borda padrão');

-- Ligar e desligar itens -----------------------------------------------------------------
select lives_ok($$ select public.admin_set_catalog_item('banner', 'nebulosa', false) $$, 'admin desliga banner');
reset role;
select tests.login_as(:'lia');
select throws_ok($$ update profiles set banner_preset = 'nebulosa' where id = auth.uid() $$, 'DS006', null, 'banner desligado não pode ser escolhido');
select lives_ok($$ update profiles set banner_preset = 'aurora' where id = auth.uid() $$, 'outros banners seguem valendo');
reset role;
select tests.login_as(:'adm');
select lives_ok($$ select public.admin_set_catalog_item('banner', 'aurora', false, 'Aurora clássica') $$, 'admin desliga o banner que lia usa');
reset role;
select is((tests.profile(:'lia')).banner_preset, 'aurora', 'quem já usa continua usando');
select tests.login_as(:'lia');
select lives_ok($$ update profiles set bio = 'oi' where id = auth.uid() $$, 'e salva o resto do perfil normalmente');
reset role;

select tests.login_as(:'adm');
select lives_ok($$ select public.admin_set_catalog_item('badge', 'curious', false) $$, 'admin desliga insígnia');
reset role;
insert into public.questions (author_id, title, body_md) values (:'rui', 'Pergunta qualquer aqui', 'corpo da pergunta com texto suficiente');
select ok(not tests.has_badge(:'rui', 'curious'), 'insígnia desligada não é mais dada pelos gatilhos');

-- Tirar algo não mexe no resto: o banner desligado que lia usa continua.
select tests.login_as(:'adm');
select lives_ok(format($$ select public.admin_revoke_badge(%L, 'sage') $$, :'lia'), 'admin tira outra insígnia da lia');
reset role;
select is((tests.profile(:'lia')).banner_preset, 'aurora', 'banner desligado em uso não é apagado por outra remoção');
select is((tests.profile(:'lia')).shown_badges, '{}'::text[], 'a insígnia tirada sai das exibidas');

-- Fundador desligado não gasta vaga.
select tests.login_as(:'adm');
select lives_ok($$ select public.admin_set_catalog_item('badge', 'founder', false) $$, 'admin desliga fundador');
reset role;
select tests.create_user('novo@x.dev', 'novato') as novo \gset
select ok(not tests.has_badge(:'novo', 'founder'), 'quem chega com fundador desligado não ganha');

-- Editar dados do perfil --------------------------------------------------------------------
select tests.login_as(:'adm');
select lives_ok(format($$ select public.admin_update_profile(%L, '{"display_name": "Rui S.", "bio": "", "remove_avatar": true}') $$, :'rui'), 'admin edita nome, limpa bio e remove foto');
select is((tests.profile(:'rui')).display_name, 'Rui S.', 'nome trocado');
select is((tests.profile(:'rui')).avatar_url, null, 'foto removida');
select throws_ok(format($$ select public.admin_update_profile(%L, '{"role": "admin"}') $$, :'rui'), '22023', null, 'campo fora da lista falha');
select throws_ok(format($$ select public.admin_update_profile(%L, '{"username": "lia"}') $$, :'rui'), '23505', null, '@ já usado falha');
select is(tests.log_count(:'rui', 'update_profile'), 1::bigint, 'edição entra no registro');
reset role;

select * from finish();
rollback;
