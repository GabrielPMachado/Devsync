# Estudos (subprojeto 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** perguntas e respostas no estilo Stack Overflow, porém limpo: perguntar, responder, votar, aceitar, ordem das respostas, "não funciona mais", "precisa de mais detalhes", edição com histórico.

**Architecture:** o banco já está pronto (migrações 000400, 000600 e 000700: tabelas, RLS, contadores, notificações, revisões e `answers_ordered`). Este subprojeto é só site: páginas em `src/app/(app)/estudos/`, Server Actions que escrevem com o cliente do usuário (a RLS decide), regras de exibição em funções puras testadas em `src/lib/studies/`. **Nenhuma migração nova** (evita colisão com a thread de Projetos).

**Tech Stack:** Next.js 16 (cacheComponents), Supabase SSR, next-intl, Tailwind 4, `react-markdown` + `remark-gfm` + `rehype-highlight` (Markdown sem HTML cru), Vitest, Playwright, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-23-devsync-arquitetura-design.md`, seção 5.4. Telas: Figma aprovado (D_07 Pergunta, Estudos, Fazer pergunta; referência em `/mnt/project-files/figma-plugin/devsync-telas/code.js`, funções `dStudies`, `dQuestion`, `dAsk`).

## Decisões desta thread (design curto)

- **Rotas:** `/estudos` (lista), `/estudos/perguntar`, `/estudos/[slug]` (pergunta + respostas + formulário), `/estudos/[slug]/editar`, `/estudos/[slug]/respostas/[id]/editar`, `/estudos/[slug]/historico` (revisões atrás de um clique; `?resposta=<id>` mostra as da resposta).
- **Lista:** abas Recentes, Sem resposta e Das tags que sigo (só logado); filtro por tag via `?tag=`; "Carregar mais" por `?pagina=`. Sem aba "Mais votadas": pergunta não recebe voto (5.4); o número de votos do card do Figma vira o número de respostas.
- **Ordem:** sempre `answers_ordered` (RPC). O selo "mais votada recentemente" é calculado no site por `pickRecentTop` (mesma regra do SQL), já que a função devolve só `answers`.
- **Avisos:** resposta com mais de 2 anos: aviso discreto "pode estar desatualizada"; com 3+ marcações: aviso forte. Ambos por `answerNotice`.
- **Votos:** ▲/▼ por resposta; clicar no voto atual retira. Placar negativo aparece como "0" com tom apagado (nunca número negativo em destaque, `displayScore`).
- **"Precisa de mais detalhes":** botão para os outros; para o autor, um painel educado com o modelo de como melhorar quando `detail_requests_count > 0`. A notificação já sai pelo gatilho do banco.
- **"Veja também":** se `duplicate_of_id` estiver preenchido (moderação, subprojeto 7), mostra link para a original. Pergunta não é fechada.
- **Tag `iniciante`:** chip em destaque e lembrete de paciência no formulário de resposta.
- **Tags:** 1 a 5, texto livre normalizado (`normalizeTagSlugs`); tag inexistente é criada (a RLS permite).
- **Fora deste PR (anotado):** demo na resposta (espera o `<DemoOverlay>` do subprojeto 4), comentários em pergunta/resposta (vêm com os comentários do 4), filtro de tom com IA (desligado por `MODERATION_AI_ENABLED=false`), apagar pergunta/resposta.

## Global Constraints

- Todos os textos em `messages/pt-BR.json` (namespace `Studies`), nada de string solta na UI.
- Leitura de sessão só dentro de `<Suspense>` e `connection()` antes do Supabase (cacheComponents).
- Markdown nunca renderiza HTML cru (sem `rehype-raw`).
- Escritas só pelo cliente do usuário (anon key + cookies). Nada de service role.
- Não aplicar nada no Supabase remoto.

## Review Focus

1. Visitante clicando em votar/responder: vai para `/entrar?next=<pergunta>` em vez de erro.
2. Autor votando na própria resposta ou marcando "não funciona mais" nela: botão não aparece; a RLS barra a chamada direta.
3. Título com < 10 ou > 150 caracteres, corpo vazio, 0 ou 6 tags: erro em pt-BR no campo, nada gravado.
4. Falha ao gravar as tags depois de criar a pergunta: a pergunta é apagada (sem pergunta órfã sem tags).
5. Slug inexistente ou pergunta oculta: 404.

---

### Task 1: Regras puras (ordem, selo, avisos, placar, tags, formulários)

**Files:** Create `src/lib/studies/rules.ts`, `src/lib/studies/rules.test.ts`.

**Produces:**
- `pickRecentTop(answers: RankedAnswer[], acceptedId: string | null): string | null` com `RankedAnswer = { id; score; createdAt: string; outdatedFlags }`: id da mais nova que passou a aceita (criada depois, score ≥ 5, score ≥ 2× aceita, < 3 marcações; a de maior score, empate mais nova), senão null.
- `answerNotice(a: { createdAt; outdatedFlags }, now: Date): "flagged" | "old" | null` (flagged se ≥ 3; old se > 2 anos).
- `displayScore(score: number): number` → `max(score, 0)`.
- `normalizeTagSlugs(raw: string): string[]` (separa por vírgula/espaço, minúsculas, tira `#` do começo, deduplica, filtra pelo padrão `^[a-z0-9][a-z0-9+#.-]{0,29}$`).
- `validateQuestion({ title, body, tags }): QuestionErrors` e `validateAnswer({ body, techVersion }): AnswerErrors` (limites do banco: título 10–150, corpo 1–30000, tags 1–5, versão ≤ 40).

Tests: os quatro casos da 5.4 para `pickRecentTop` (≥5 e ≥2×; abaixo de 5; abaixo do dobro; mais antiga não conta; só a mais forte; marcada não conta; sem aceita → null), `answerNotice` nas bordas de 2 anos e 3 marcações, e as validações.

### Task 2: Leitura de dados

**Files:** Create `src/lib/studies/queries.ts` (server-only).
**Produces:** `listQuestions({ tab: "recent" | "unanswered" | "following", tag?: string, page: number })`, `getQuestion(slug)`, `getAnswers(questionId, viewerId)` (RPC `answers_ordered` + autores + votos/marcações do visitante), `getRevisions(type, id)`, `getMyDetailRequest`.

### Task 3: Server Actions

**Files:** Create `src/app/(app)/estudos/actions.ts`, `actions.test.ts` (mock do Supabase como em `boas-vindas/actions.test.ts`).
**Produces:** `askQuestion`, `editQuestion`, `postAnswer`, `editAnswer` (useActionState: `(prev, formData) => State`), e `voteAnswer(answerId, value: 1 | -1 | 0, slug)`, `acceptAnswer(questionId, answerId | null, slug)`, `toggleOutdated(answerId, on, slug)`, `toggleDetailRequest(questionId, on, slug)`. Todas exigem visitante com @ (senão redirect para `/entrar?next=`), terminam com `revalidatePath`/`redirect`.
Tests: validação devolve erros sem tocar no banco; pergunta é apagada se as tags falham; voto 0 apaga; visitante é redirecionado.

### Task 4: Páginas e componentes

**Files:** `src/app/(app)/estudos/page.tsx`, `perguntar/page.tsx`, `[slug]/page.tsx`, `[slug]/editar/page.tsx`, `[slug]/respostas/[id]/editar/page.tsx`, `[slug]/historico/page.tsx`; `src/components/studies/` (`markdown.tsx`, `question-card.tsx`, `answer-card.tsx`, `vote-buttons.tsx`, `question-form.tsx`, `answer-form.tsx`, `markdown-editor.tsx` com abas Escrever/Visualizar); `messages/pt-BR.json`.
Tests: `markdown.test.tsx` (não renderiza `<script>`/HTML cru, código ganha classe de destaque), `answer-card.test.tsx` (selos aceita/mais votada recentemente/avisos; placar negativo vira 0).

### Task 5: Testes do banco e E2E

**Files:** Modify `supabase/tests/database/07_read_functions.test.sql` (casos extras: desafiante marcado não passa a aceita; empate de desafiantes vai para o mais novo). Create `e2e/studies.spec.ts`: Ana pergunta (tags `react`, `iniciante`) → Bruno responde → Ana vê a resposta, aceita → Bruno vota não aparece na própria; Carla vota ▲; histórico aparece depois de Ana editar a pergunta.
Verificação: `npm run lint && npm run typecheck && npm test`, `supabase test db`, `npm run build && npm run test:e2e`.
