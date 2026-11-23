begin;
\ir ../helpers.sql
select plan(14);

select tests.create_user('ana@x.dev', 'ana') as ana \gset
select tests.create_user('bruno@x.dev', 'bruno') as bruno \gset
select tests.create_user('carla@x.dev', 'carla') as carla \gset

select tests.login_as(:'ana');
insert into projects (title) values ('Projeto da Ana') returning id as proj \gset
insert into questions (title, body_md) values ('Pergunta da Ana sobre SQL', 'corpo') returning id as q \gset

-- Alvo inexistente.
select tests.login_as(:'bruno');
select throws_ok(format($$ insert into comments (target_type, target_id, body_md) values ('project', %L, 'oi') $$, gen_random_uuid()), '42501', null, 'comment on missing target fails');

-- Dois níveis: resposta a uma resposta vai para a raiz.
insert into comments (target_type, target_id, body_md) values ('project', :'proj', 'Raiz') returning id as c_root \gset
insert into comments (target_type, target_id, parent_id, body_md) values ('project', :'proj', :'c_root', 'Resposta') returning id as c_reply \gset
select tests.login_as(:'carla');
insert into comments (target_type, target_id, parent_id, body_md) values ('project', :'proj', :'c_reply', 'Resposta da resposta') returning id as c_deep \gset
select is((select parent_id from comments where id = :'c_deep'), :'c_root'::uuid, 'reply to reply attaches to root');
select is((select depth from comments where id = :'c_deep'), 1::smallint, 'reply depth is 1');
select is((select depth from comments where id = :'c_root'), 0::smallint, 'root depth is 0');
select throws_ok(format($$ insert into comments (target_type, target_id, parent_id, body_md) values ('question', %L, %L, 'x') $$, :'q', :'c_root'), '23514', null, 'parent precisa ser do mesmo alvo');
select is((select comments_count from projects where id = :'proj'), 3, 'comment bumps comments_count on target');

-- Edição guarda revisão; ninguém edita comentário alheio.
update comments set body_md = 'Editado' where id = :'c_root';
select is((select body_md from comments where id = :'c_root'), 'Raiz', 'cannot edit someone else''s comment');
select tests.login_as(:'bruno');
update comments set body_md = 'Raiz editada' where id = :'c_root';
select tests.as_anon();
select is((select body_md from revisions where target_type = 'comment' and target_id = :'c_root'), 'Raiz', 'editing comment stores revision (visível ao público)');

-- Alvo oculto.
reset role;
update projects set hidden_at = now() where id = :'proj';
select tests.login_as(:'carla');
select throws_ok(format($$ insert into comments (target_type, target_id, body_md) values ('project', %L, 'oi') $$, :'proj'), '42501', null, 'cannot comment on hidden project');
select tests.as_anon();
select is((select count(*)::int from comments where target_id = :'proj'), 0, 'comentários de projeto oculto somem');
select is((select count(*)::int from revisions where target_id = :'c_root'), 0, 'revisões de comentário oculto somem');

-- Apagar a pergunta leva comentários e revisões junto.
select tests.login_as(:'bruno');
insert into comments (target_type, target_id, body_md) values ('question', :'q', 'comentário na pergunta');
select tests.login_as(:'ana');
update questions set body_md = 'corpo novo' where id = :'q';
delete from questions where id = :'q';
reset role;
select is((select count(*)::int from comments where target_type = 'question' and target_id = :'q'), 0, 'deleting question removes its comments');
select is((select count(*)::int from revisions where target_type = 'question' and target_id = :'q'), 0, 'deleting question removes its revisions');

-- Suspenso não comenta.
update profiles set suspended_at = now() where id = :'carla';
update projects set hidden_at = null where id = :'proj';
select tests.login_as(:'carla');
select throws_ok(format($$ insert into comments (target_type, target_id, body_md) values ('project', %L, 'oi') $$, :'proj'), '42501', null, 'suspended user cannot comment');

select * from finish();
rollback;
