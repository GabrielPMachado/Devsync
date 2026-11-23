# Devsync fase 1: roteiro de planos

> **For agentic workers:** este arquivo não é um plano de tarefas. Ele divide a fase 1 em subprojetos. Cada subprojeto ganha um plano próprio em `docs/superpowers/plans/`, escrito com superpowers:writing-plans na thread responsável, e executado com superpowers:subagent-driven-development ou superpowers:executing-plans.

**Objetivo:** lançar a Devsync na web (PWA, pt-BR) com projetos e demos, perguntas e respostas, comentários e a parte social.

**Spec:** `docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md`

**Por que dividir:** a spec junta sistemas independentes (visual, banco, site, serviço de demos, moderação). Um plano único seria grande demais para revisar. Cada subprojeto abaixo entrega algo que funciona e pode ser testado sozinho.

## Restrições globais (valem para todos os planos)

- TypeScript em tudo. Next.js (App Router) na Vercel, Supabase (Postgres, Auth, Storage, Realtime), Cloudflare R2 e Workers para demos.
- Custo atual: US$ 0. Só planos gratuitos, endereços `*.vercel.app` e `*.workers.dev`. Filtro de tom com IA desligado por configuração (`MODERATION_AI_ENABLED=false`).
- Interface em pt-BR, com todos os textos em `next-intl`. URLs sem prefixo de idioma. Todo conteúdo tem `lang`, hoje sempre `pt-BR`.
- Visual: fundo escuro, gradiente azul `#2563EB` → ciano `#22D3EE`. Os tokens finais vêm do Figma (subprojeto 0).
- Permissões no banco via RLS. Nenhuma tabela pública sem política.
- Demo sempre abre por cima da Devsync. Nunca em outra guia.
- Demos enviadas servidas só de domínio separado, um subdomínio por demo.

## Subprojetos e ordem

| # | Subprojeto | Depende de | Entrega testável | Seções da spec |
|---|---|---|---|---|
| 0 | **Figma**: design system, página de ícones, telas | nada | Arquivo Figma aprovado pelo Gabriel | 5.9, toda a parte de UX |
| 1 | **Banco Supabase**: schema, RLS, gatilhos, busca | nada | Migrações aplicadas + testes de RLS e gatilhos (pgTAP) passando | 5.4, 5.5, 5.6, 5.8 |
| 2 | **Base do site**: Next.js, Tailwind com tokens do Figma, next-intl, auth (GitHub + link mágico), escolha de @usuário, layout | 0, 1 | Login funcionando de ponta a ponta, teste E2E (Playwright) | 5.7, 5.9 |
| 3 | **Serviço de demos**: Worker que serve `*.workers.dev`, upload por URL assinada, fila de descompactação e validação, checagem de embed de links | 1 | Testes do Worker (Vitest + Miniflare) para zip válido, zip inválido, `Sec-Fetch-Dest` e CSP | 5.2, 5.3 |
| 4 | **Projetos**: publicar projeto com demo, página do projeto, camada de demo sobre o feed, curtidas, comentários | 2, 3 | E2E: publicar com zip, abrir demo na camada | 5.3, 5.5 |
| 5 | **Estudos**: perguntas, respostas, votos, resposta aceita, ordem das respostas, "desatualizada", "precisa de mais detalhes", revisões | 2 | Testes da ordem das respostas (todas as regras da 5.4) + E2E de perguntar e responder | 5.4 |
| 6 | **Social e descoberta**: perfil, seguir, notificações em tempo real, feed, explorar, busca | 4, 5 | E2E: seguir alguém e ver o post no feed, receber notificação | 5.5, 5.6 |
| 7 | **Moderação**: denúncias, `/admin`, suspender demo e conta, filtro de tom (desligado por padrão) | 4, 5 | E2E de denúncia → ação do admin | 5.4, 5.3 |
| 8 | **Lançamento**: PWA, SEO (metadados, sitemap), revisão de segurança, testes de carga leves | 2 a 7 | Lighthouse PWA ok, revisão de segurança sem pendências | 5.9, 6 |

O 0 e o 1 andam em paralelo agora. O 2 começa quando os dois terminam. O 3 pode começar logo depois do 1.

## Contratos entre subprojetos

Estes nomes são fixos. Quem planejar um subprojeto usa exatamente estes:

- **Tabelas e colunas:** as da seção 5.8 da spec, com os nomes em inglês como estão lá (`profiles`, `projects`, `demos`, `questions`, `answers`, `answer_votes`, `outdated_flags`, `detail_requests`, `revisions`, `comments`, `notifications`, `reports`, `follows`, `tags`, ...).
- **Enum `demo_kind`:** `web_link | web_upload | sandbox | mobile`. **Enum `demo_status`:** `pending | live | blocked | unavailable`.
- **Ordem das respostas:** função SQL `answers_ordered(question_id uuid) returns setof answers`, criada no subprojeto 1 e usada pelo 5. As regras estão na seção 5.4 da spec.
- **Busca:** função SQL `search_content(q text, tag_slugs text[], kinds text[]) returns table(kind text, id uuid, title text, rank real)`, criada no 1.
- **Feed:** função SQL `home_feed(before timestamptz, page_size int) returns table(kind text, id uuid, created_at timestamptz)`, criada no 1.
- **Serviço de demos (subprojeto 3), chamado pelo site:**
  - `POST /uploads` → `{ demoId, uploadUrl }` (URL assinada do R2)
  - `POST /uploads/:demoId/complete` → enfileira validação. Resultado gravado em `demos.status`.
  - `POST /embed-check` `{ url }` → `{ embeddable: boolean, reason?: string }`
  - Demo servida em `https://<demo_id>.<DEMOS_HOST>/`. `DEMOS_HOST` é variável de ambiente.
- **Componente da camada de demo (subprojeto 4):** `<DemoOverlay demoId={string} onClose={() => void} />`, reaproveitado pelas respostas no 5.

## Pontos de atenção para os revisores

1. Zip com caminho malicioso (`../`, links simbólicos) ou extensões fora da lista permitida: precisa ser recusado no 3.
2. Usuário suspenso tentando postar por chamada direta à API do Supabase: a RLS do 1 tem que bloquear, não só a interface.
3. Link de demo que passa a bloquear embed depois de publicado: a checagem diária do 3 marca `unavailable`, e o 4 mostra a demo como indisponível em vez de uma tela em branco.
4. Ordem das respostas com empates e com resposta aceita sem votos: os testes do 1 cobrem os quatro casos da seção 5.4.
5. Projeto do Supabase gratuito pausado: o site mostra uma página de manutenção amigável, e não um erro.
