# Moderação de perfis e catálogo — plano

> Executado inline (executing-plans). Spec: docs/superpowers/specs/2026-11-25-devsync-moderacao-perfis-design.md

**Arquitetura:** migration `20261125400000_admin_profiles.sql` com tabelas + RPCs; teste pgTAP
`17_admin_profiles.test.sql`; server actions em `src/lib/moderation/profile-actions.ts`; consultas em
`src/lib/moderation/profile-queries.ts`; regras puras em `src/lib/moderation/catalog.ts`; telas em
`src/app/(app)/admin/perfis/[username]/page.tsx` e componentes em `src/components/moderation/`.

## Revisão: atenção
- Admin removendo a própria insígnia/editando o próprio perfil: deve funcionar e registrar.
- `@` novo inválido ou já usado: mensagem clara (23505 / 23514).
- Item desligado que a pessoa já usa: continua aparecendo no editor como selecionado.
- Não admin chamando RPC: erro 42501.
- `apply_api_grants()` redefinida precisa manter tudo e incluir as novas funções.

### Tarefa 1: banco (TDD com pgTAP)
Tabelas: `catalog_item_state(kind text check in ('banner','accent','frame','badge'), key text, active bool, updated_by, updated_at, pk(kind,key))`
(leitura pública), `profile_item_grants(profile_id, kind check in ('frame','banner','accent'), key, granted_by, granted_at, pk)` (leitura pública),
`admin_actions(id bigint identity, admin_id, action text, profile_id, details jsonb, created_at)` (só admins leem).
Funções: `public.catalog_item_active(kind,key)`, `public.admin_set_catalog_item(kind,key,active)`,
`public.admin_award_badge(profile_id uuid, badge text, notify boolean default true)`, `public.admin_revoke_badge(profile_id, badge)`,
`public.admin_grant_item(profile_id, kind, key)`, `public.admin_revoke_item(profile_id, kind, key)`,
`public.admin_update_profile(profile_id uuid, changes jsonb)` (chaves: username, display_name, headline, location, status, bio,
remove_avatar, remove_banner, reset_appearance), `public.admin_profile_history(profile_id)`.
Ajustes: `private.award_badge` ignora insígnia desligada; `private.profiles_check_badges` aceita borda liberada à mão e recusa
banner/cor/borda desligados (erro DS006) quando mudam, salvo liberação.
- [ ] teste pgTAP falhando → migration → `supabase test db` verde → commit.

### Tarefa 2: lib (TDD vitest)
`catalog.ts`: `isItemAvailable({kind,key,disabled,granted,current})`, `CATALOG_KINDS`. `profile-actions.ts`: server actions
com `AdminResult`. Testes no padrão de `actions.test.ts`.

### Tarefa 3: telas
Abas "Perfis" e "Catálogo" no /admin, página do perfil, editor de perfil respeita itens desligados e bordas liberadas.
Mensagens em `messages/pt-BR.json` grupo `AdminProfiles`. Testes de componente.

### Tarefa 4: entrega
SQL para o remoto em /mnt/project-files/supabase/aplicar-moderacao-perfis.sql; lint, typecheck, test, build; revisão; PR.
