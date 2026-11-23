begin;
\ir ../helpers.sql
select plan(12);

select has_type('public', 'user_role', 'enum user_role existe');
select enum_has_labels('public', 'demo_kind', array['web_link', 'web_upload', 'sandbox', 'mobile'], 'demo_kind do contrato');
select enum_has_labels('public', 'demo_status', array['pending', 'live', 'blocked', 'unavailable'], 'demo_status do contrato');
select enum_has_labels('public', 'comment_target', array['project', 'question', 'answer'], 'comment_target');
select enum_has_labels('public', 'revision_target', array['project', 'question', 'answer', 'comment'], 'revision_target');
select enum_has_labels('public', 'report_target', array['project', 'question', 'answer', 'comment', 'demo', 'profile'], 'report_target');
select enum_has_labels('public', 'report_status', array['open', 'dismissed', 'actioned'], 'report_status');
select enum_has_labels('public', 'notification_type',
  array['follow', 'comment', 'reply', 'answer', 'accepted', 'like', 'vote', 'detail_request'], 'notification_type');
select enum_has_labels('public', 'notification_target', array['profile', 'project', 'question', 'answer', 'comment'], 'notification_target');
select is(public.slugify('Olá, Mundo! Ação em C++'), 'ola-mundo-acao-em-c', 'slugify tira acentos e símbolos');
select is(length(public.slugify(repeat('palavra ', 30))), 60, 'slugify corta em 60');
select has_table('public', 'revisions', 'tabela revisions existe');

select * from finish();
rollback;
