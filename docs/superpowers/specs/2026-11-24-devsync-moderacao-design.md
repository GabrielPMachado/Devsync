# Devsync: moderação (subprojeto 7)

**Data:** 2026-11-24 · **Roteiro:** `docs/superpowers/plans/2026-11-23-devsync-fase-1-roteiro.md` · **Spec:** seções 5.3 e 5.4 da arquitetura.

## Por quê

A Devsync promete um ambiente limpo e sem grosseria, principalmente nos Estudos. Isso só se sustenta se qualquer pessoa conseguir denunciar algo em dois cliques e o moderador (o Gabriel, no início) conseguir agir rápido numa página simples. As demos rodam código de terceiros, então precisam de um jeito de sair do ar na hora.

## O que já existe (subprojeto 1)

- Tabela `reports` com RLS (quem denuncia vê a própria denúncia; admin vê todas; uma denúncia por pessoa e alvo).
- RPCs de admin: `admin_set_hidden`, `admin_suspend_profile`, `admin_set_demo_status`, `admin_resolve_report`, `admin_mark_duplicate`.
- `hidden_at` em projeto, pergunta, resposta e comentário; `suspended_at` no perfil (RLS bloqueia quem está suspenso); demo `blocked` some e o Worker para de servir.

## Objetivos

1. **Botão "Denunciar"** discreto em projeto, demo (na camada da demo), pergunta, resposta, comentário e perfil. Abre um diálogo com motivos prontos (spam, grosseria ou ofensa, conteúdo impróprio, golpe ou código malicioso, outro) e um campo opcional de detalhes. Se a pessoa já denunciou, aparece "Você já denunciou isto".
2. **Página `/admin`** (só admin; para os demais é 404). Fila de denúncias abertas **agrupadas por alvo** (o mesmo comentário denunciado 5 vezes aparece uma vez, com "5 denúncias" e os motivos). Cada item mostra a prévia do conteúdo, o autor e o link. Ações:
   - ocultar / mostrar de novo (projeto, pergunta, resposta, comentário);
   - suspender / reativar demo;
   - suspender / reativar a conta do autor;
   - marcar pergunta como repetida ("veja também", colando o endereço da original);
   - descartar (sem ação).
   Toda ação fecha as denúncias abertas daquele alvo como `actioned`; descartar fecha como `dismissed`. Aba "Resolvidas" com as últimas 50.
3. **Domínios bloqueados para demos** (spec 5.3): o admin bloqueia um domínio pela `/admin`; links de demo nesse domínio (ou subdomínios) são recusados ao publicar, e demos já publicadas nele ficam `blocked` na hora.
4. **Filtro de tom** (spec 5.4): antes de publicar resposta ou comentário, um classificador avisa se o texto pode soar ríspido. A pessoa escolhe "Revisar texto" ou "Publicar assim mesmo". **Avisa, não bloqueia.** Desligado por padrão (`MODERATION_AI_ENABLED=false`); ligado, usa Claude Haiku (`claude-haiku-5-5`) com a chave `ANTHROPIC_API_KEY`. Qualquer falha da IA deixa publicar normalmente.
5. Link "Moderação" no menu da conta, só para admins.

## Não objetivos

- Avisar o autor que o conteúdo foi ocultado, ou avisar quem denunciou do resultado (depois do lançamento).
- Moderação automática (ocultar por número de denúncias).
- Vários moderadores com papéis diferentes.
- Ocultar automaticamente o conteúdo antigo de quem foi suspenso.

## Abordagens consideradas

- **Fila agrupada numa função SQL `admin_report_queue()` (escolhida).** Uma chamada devolve alvo, contagem, motivos e prévia; o banco garante que só admin chama. Simples de testar com pgTAP.
- Montar a fila no Next.js com várias consultas: mais idas ao banco e lógica de prévia espalhada por tipo.
- **Filtro de tom no servidor do Next.js (escolhida)** em vez de Edge Function do Supabase como diz a spec: a resposta e o comentário já passam por server actions, então a checagem fica no mesmo passo, sem deploy separado em Deno. Decisão minha, troca fácil depois.

## Banco (migration `20261124200000_moderation.sql`)

- `blocked_domains(domain text pk, reason text, created_by, created_at)`; RLS: só admin lê; escrita só por RPC.
- `admin_block_domain(domain, reason)` / `admin_unblock_domain(domain)`: normaliza (minúsculas, sem `www.`), e ao bloquear marca `blocked` as demos `web_link` daquele domínio.
- Gatilho em `demos` (insert e update de `url`): recusa link de domínio bloqueado com erro `P0001` e mensagem "Domínio bloqueado".
- `admin_report_queue(p_status report_status)`: agrupado por alvo, com `report_count`, `reasons text[]`, `first_reported_at`, `last_reported_at`, autor (id, @, suspenso?), prévia (título ou trecho), `hidden` e o caminho para abrir.
- `admin_resolve_target(target, target_id, status)`: fecha todas as denúncias abertas daquele alvo.

## Para o Gabriel virar admin

Arquivo SQL para o SQL Editor do Supabase: aplica a migration e roda `update profiles set role = 'admin' where username = '<seu @>'`.

## Testes

- pgTAP: fila agrupada, permissão (não admin não chama), domínio bloqueado (inclui subdomínio e normalização), bloqueio retroativo, resolver por alvo.
- Vitest: regras do diálogo de denúncia, montagem do motivo, filtro de tom (desligado, ligado com resposta "ríspido", falha da IA).
- Playwright: Bruno denuncia o comentário da Ana → admin vê na fila → oculta → o comentário some para os outros.

## Limites conhecidos (da revisão)

- URLs de demo precisam estar na forma canônica (host ASCII simples, sem usuário, `%`, `\`, espaços ou ponto final), para o host que o banco lê ser o mesmo que o navegador abre.
- Um link que **redireciona** para um domínio bloqueado não é pego na publicação: o serviço de demos segue os redirecionamentos, mas não consulta a lista. Fica para o subprojeto 8 (revisão de segurança).
- Ação e fechamento das denúncias são duas chamadas; se a segunda falhar, o admin vê o erro e pode repetir.
