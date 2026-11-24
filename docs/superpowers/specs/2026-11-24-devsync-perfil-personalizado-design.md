# Perfil personalizado: editar perfil, banner, bordas e insígnias

Data: 2026-11-24 · Pedido do Demonity · Thread "Melhorar a tela de editar perfil"

## Por quê

O dono do produto acha a tela de editar perfil pouco completa, bonita e organizada.
O que mais incomoda: **o perfil tem muita estatística e pouca personalização**. Hoje o
cabeçalho mostra 5 números (seguidores, seguindo, projetos, respostas, aceitas), a capa
é o mesmo gradiente para todo mundo, a foto não pode ser trocada e só há nome, bio,
GitHub, site e tecnologias.

Ele pediu explicitamente: **banner, borda de avatar, trocar foto, insígnias**. Insígnias
são **conquistadas**. Bordas: **algumas liberadas por conquista, outras para todos**.

## Objetivos

- O perfil passa a ser "da pessoa": banner próprio, foto própria, borda escolhida,
  insígnias à mostra, cargo, localização, status e mais links.
- Estatística continua existindo, mas discreta (uma linha pequena).
- A tela de editar fica organizada em seções, com prévia ao vivo, boa no celular.
- Insígnias dão motivo para participar (publicar, responder, ajudar).

## Não objetivos (agora)

- Trocar @usuário, e-mail, senha; privacidade; preferências de notificação.
- Bloco "Sobre" em Markdown livre (descartado: fica bagunçado).
- Temas de página inteira, música, animações pesadas.
- Insígnias manuais dadas por admin (o modelo deixa espaço, mas sem tela).

## Anti-objetivos

- Perfil poluído ou com cara de "gamificação de cassino": no máximo 3 insígnias ao lado
  do nome, bordas sóbrias dentro da identidade azul/ciano.
- Qualquer pessoa conseguir exibir insígnia ou borda que não conquistou (precisa ser
  garantido pelo banco, não só pela tela).
- Arquivos órfãos acumulando no Storage a cada troca de foto/banner.

## Abordagens consideradas

1. **Identidade (escolhida).** Campos novos + banner/foto/borda + insígnias conquistadas.
2. Página livre estilo README em Markdown: muita liberdade, fica bagunçado, foge do
   "limpo" da Devsync. Descartada.
3. Só visual (capa, foto, cor) sem campos novos: rápido, mas o perfil continua dizendo
   pouco. Descartada.

Para as insígnias:
- **Gravar a conquista no banco na hora em que acontece (escolhida):** tabela com data
  da conquista, preenchida por gatilhos do próprio Postgres. Permanente.
- Calcular na hora a partir dos números: sem data, e a insígnia some se o número cair.
- Verificação agendada (cron): precisa de serviço extra, fora do orçamento grátis.

## Entrega em duas partes (dois PRs, nesta ordem)

### Parte 1: perfil personalizável e nova tela de editar

**Banco (migration nova, colunas em `profiles`):**

| coluna | tipo | regra |
|---|---|---|
| `headline` | text | até 80 caracteres ("Dev front-end na Acme") |
| `location` | text | até 60 caracteres |
| `status` | text | uma das chaves fixas ou nulo: `open_to_work`, `building`, `learning`, `mentoring`, `freelance` |
| `banner_url` | text | URL do banner enviado (bucket `banners`) ou nulo |
| `banner_preset` | text | chave de um banner pronto (`aurora`, `circuito`, `grade`, `ondas`, `noite`, `hex`) ou nulo |
| `avatar_frame` | text | chave da borda ou nulo (sem borda) |
| `accent` | text | cor de destaque: `azul`, `ciano`, `violeta`, `verde`, `ambar`, `rosa`; padrão nulo = azul |

- Status em chaves fixas (não texto livre): sem moderação de texto, traduzível depois.
- Se `banner_url` existe ele vence; senão `banner_preset`; senão o gradiente atual.
- `links` (jsonb já existente) passa a aceitar também `linkedin` (usuário), `x`
  (usuário), `youtube` (@canal) e continua com `github` e `site`. Sem mudança de schema.
- Ampliar o `grant update (...)` de `profiles` para as colunas novas.
- Bucket `banners` público, 4 MB, png/jpeg/webp, mesmas políticas de dono do
  `avatars`. Como o remoto não tem grants automáticos (ver PR #11), a migration e um
  arquivo para o SQL Editor (`/mnt/project-files/supabase/aplicar-perfil-personalizado.sql`)
  saem juntos.
- Checagens (`check`) no banco para tamanho e chaves válidas de status, banner_preset,
  accent. `avatar_frame` só aceita o formato `^[a-z0-9_]{1,30}$` na parte 1; a checagem de
  "você liberou essa borda?" entra na parte 2.

**Fotos e banner:**
- Escolher arquivo → recortar na própria tela (arrastar + zoom), foto quadrada 512×512,
  banner 3:1 1500×500 → converte para WebP no navegador (canvas) → envia para o Storage.
- O navegador guarda a imagem recortada e **só envia ao clicar em Salvar** (antes disso
  ela aparece apenas na prévia). Sair sem salvar não muda nada no perfil publicado.
- Caminho fixo por pessoa (`avatars/<id>/avatar.webp`, `banners/<id>/banner.webp`), com
  `upsert`, e a URL salva leva `?v=<timestamp>` para furar cache. Assim não há órfãos.
- Botões "Remover foto" / "Remover banner": apagam o arquivo e zeram a coluna. Sem foto,
  aparecem as iniciais (a foto do GitHub do cadastro não volta; trocar a foto a substitui).
- O banco só aceita em `avatar_url`/`banner_url`: nulo, o valor atual (ex.: foto do
  GitHub vinda do cadastro) ou uma URL do próprio Storage na pasta da pessoa
  (`.../storage/v1/object/public/<bucket>/<id>/...`). Impede apontar para imagem externa
  pela API.
- Recorte sem biblioteca nova (componente próprio com canvas), funciona com toque.

**Tela de editar (`/configuracoes`):**
- Desktop: à esquerda as seções em cartões, à direita uma **prévia ao vivo** fixa do
  cabeçalho do perfil (banner, foto com borda, nome, cargo, status, links).
- Celular: prévia compacta no topo, seções empilhadas, barra "Salvar" fixa no rodapé.
- Seções:
  1. **Aparência:** banner (enviar ou escolher pronto), foto, borda do avatar (grade de
     opções; bloqueadas aparecem com cadeado a partir da parte 2), cor de destaque.
  2. **Sobre você:** nome, cargo, localização, status, bio (contador).
  3. **Links:** GitHub, LinkedIn, X, YouTube, site, cada um com ícone e prefixo.
  4. **Tecnologias:** o seletor por categorias que já existe (PR #14).
  5. **Insígnias** (parte 2).
- Um botão Salvar para tudo (as imagens sobem ao escolher, mas só passam a valer no
  perfil ao salvar). Avisar ao sair com mudanças não salvas.

**Página do perfil (`/@usuario`):**
- Banner da pessoa, foto com a borda escolhida, nome, cargo, chip de status,
  localização, ícones dos links, bio, tecnologias.
- Números viram uma linha pequena: "120 seguidores · 34 seguindo". Projetos, perguntas e
  respostas ficam só nas contagens das abas (já existem). "Aceitas" sai do cabeçalho.
- A cor de destaque tinge detalhes (anel do status, links, aba ativa) só no perfil.
- A borda aparece também no avatar grande do perfil; nos avatares pequenos do feed,
  não (decisão: mantém o feed limpo).

### Parte 2: insígnias e bordas por conquista

**Catálogo inicial (no código, `src/lib/social/badges.ts`, e espelhado no SQL):**

| chave | nome | como ganha |
|---|---|---|
| `founder` | Membro fundador | estar entre os 1.000 primeiros perfis com @ |
| `first_project` | Primeiro projeto | publicar 1 projeto |
| `builder` | Construtor | 5 projetos |
| `curious` | Curioso | primeira pergunta |
| `first_accepted` | Primeira resposta aceita | 1 resposta aceita |
| `mentor` | Mentor | 10 respostas aceitas |
| `popular` | Popular | 50 seguidores |

**Bordas:** livres para todos: `azul`, `ciano`, `gradiente`, `neutra`. Por conquista:
`neon` (Mentor), `colchetes` (Construtor), `dourada` (Membro fundador).

**Banco:**
- `user_badges (profile_id, badge, awarded_at)`, PK `(profile_id, badge)`, leitura
  pública, sem escrita pela API (só gatilhos `security definer`).
- Resposta aceita na própria pergunta **não conta** para `first_accepted`/`mentor`.
- Fundador: os 1.000 primeiros a escolher um @, na ordem em que escolhem (gatilho ao
  definir `username` conta quantos `founder` já existem). Backfill pela ordem de
  `created_at` dos perfis que já têm @. Contas suspensas contam igual (call da thread).
- Gatilhos dão a insígnia quando: projeto criado, pergunta criada, resposta aceita,
  contador de seguidores muda, @ escolhido (fundador). Conquista é permanente: apagar
  conteúdo depois não tira a insígnia.
- Backfill na migration para quem já cumpre as regras hoje.
- `profiles.shown_badges text[]` (até 3) e `profiles.avatar_frame`: gatilho recusa
  insígnia não conquistada e borda bloqueada não liberada.
- Notificação "Você ganhou a insígnia X" (valor novo `badge` no enum de notificações).

**Tela:**
- Seção "Insígnias" no editar: todas as insígnias, conquistadas coloridas, as outras
  apagadas com "como ganhar"; marcar até 3 para exibir.
- Bordas bloqueadas com cadeado e dica de como liberar.
- No perfil: as 3 escolhidas ao lado do nome (ícone + nome no hover/toque) e um bloco
  "Conquistas" com todas as conquistadas.

## Restrições

- Next.js 16 (App Router, ler docs em `node_modules/next/dist/docs/` antes), Supabase,
  Tailwind 4, next-intl (PT-BR). Orçamento US$ 0: só Supabase Storage grátis.
- Remoto sem grants automáticos: toda tabela/coluna nova precisa de grant explícito e de
  arquivo SQL para o usuário rodar.
- Testes: pgTAP em `supabase/tests/database`, Vitest para regras e componentes,
  Playwright para o fluxo de editar perfil.
- Acessibilidade: recorte operável por teclado (setas e +/-), textos alternativos,
  contraste do PR #12.

## Decisões do construtor (calls desta thread, podem ser revistas)

- Lista exata de status, presets de banner, cores de destaque e desenho das bordas/
  ícones das insígnias.
- Borda só no avatar grande; feed sem bordas.
- 1.000 como corte do fundador.
- Recorte próprio em vez de biblioteca.
- Imagem só sobe ao salvar; remover foto volta às iniciais.
- Auto-aceite não conta; fundador = 1.000 primeiros a escolher @.
- URLs de imagem restritas à pasta da pessoa no Storage.

## Deixado para quem implementa

- Desenho visual fino de cada preset de banner e borda (SVG/CSS), dentro dos tokens.
- Estrutura de componentes e nomes de arquivos.
- Como mostrar o aviso de "mudanças não salvas".
