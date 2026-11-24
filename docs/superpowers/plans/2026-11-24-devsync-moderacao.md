# Moderação: plano de implementação

> Spec: `docs/superpowers/specs/2026-11-24-devsync-moderacao-design.md`. Executado com TDD (teste falhando primeiro em cada tarefa).

1. **Banco** — `supabase/tests/database/10_moderation_queue.test.sql` (falha) → `supabase/migrations/20261124200000_moderation.sql` com `blocked_domains`, gatilho de domínio em `demos`, `admin_block_domain`, `admin_unblock_domain`, `admin_report_queue`, `admin_resolve_target`. Rodar `scripts/test-db.sh`.
2. **Regras puras** — `src/lib/moderation/rules.ts` (+ teste): motivos de denúncia, `buildReason`, validação, caminho do alvo, normalização de domínio no cliente.
3. **Filtro de tom** — `src/lib/moderation/tone.ts` (+ teste com cliente falso): desligado por padrão, `claude-haiku-5-5` com saída estruturada quando ligado, falha = deixa publicar.
4. **Ações** — `src/app/(app)/moderacao/actions.ts`: `reportContent` (qualquer membro) e ações de admin chamando as RPCs (+ teste com Supabase falso).
5. **Botão Denunciar** — `src/components/moderation/report-button.tsx` (+ teste) e uso em projeto, camada de demo, pergunta, resposta, comentário e perfil.
6. **Tom nas respostas e comentários** — `addComment` e `postAnswer` devolvem `toneWarning` quando o texto soa ríspido e não veio `confirmTone`; formulários mostram o aviso com "Revisar texto" e "Publicar assim mesmo".
7. **/admin** — `src/app/(app)/admin/page.tsx`: abas Abertas e Resolvidas, cartões agrupados com ações, seção de domínios bloqueados. `Viewer.isAdmin`; link "Moderação" no menu da conta.
8. **E2E** — `e2e/moderation.spec.ts`: denúncia → fila → ocultar → some para os outros. O admin é promovido no Supabase local pelo `SUPABASE_SERVICE_ROLE_KEY` do CI.
9. **SQL para o remoto** — arquivo para o SQL Editor com a migration e a promoção do Gabriel a admin.
