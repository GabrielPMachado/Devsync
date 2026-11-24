# Devsync subprojeto 6: Social e descoberta (design)

**Base:** spec de arquitetura, seções 5.5 e 5.6; roteiro da fase 1 (subprojeto 6); telas aprovadas no Figma (Perfil, Notificações, Início, Explorar, Busca).

## Intenção

Fechar o ciclo social da fase 1: a pessoa segue alguém, vê o que essa pessoa publica no início, recebe notificações na hora e descobre projetos, perguntas e pessoas. Entrega testável do roteiro: E2E de seguir alguém e ver o post no feed, e de receber notificação.

## O que já existe (subprojeto 1)

`follows` com contadores, `tag_follows`, `profile_tags`, `notifications` com gatilhos para todos os eventos e publicação no Realtime, `home_feed`, `search_content`. Falta a interface e duas leituras.

## Objetivos

1. **Perfil** (`/@usuario`): Seguir/Seguindo, links (GitHub, site), números (seguidores, seguindo, projetos, respostas, aceitas), tecnologias, abas Projetos / Perguntas / Respostas (`?aba=`). Listas `/@usuario/seguidores` e `/@usuario/seguindo`.
2. **Editar perfil** (`/configuracoes`): nome, bio, links (`links.github`, `links.site`), tecnologias (tags).
3. **Notificações** (`/notificacoes`): lista agrupada na leitura (mesmo tipo + mesmo alvo, não lidas juntas: "Ana e mais 4 curtiram"), filtros Todas / Respostas / Seguidores, "Marcar todas como lidas", "Seguir de volta". Abrir a página marca como lidas as exibidas. Sino no topo e aba do celular com contador de não lidas, atualizado por Supabase Realtime, e um aviso (toast) quando chega uma nova.
4. **Início** (`/`): logado, feed de `home_feed` (projetos e perguntas de quem segue, das tags que acompanha e dele mesmo) com "Carregar mais" por cursor; coluna lateral "Quem seguir" e "Sem resposta"; menu de tags acompanhadas. Visitante mantém o hero e vê os mais recentes.
5. **Explorar** (`/explorar`): projetos em alta, perguntas sem resposta, pessoas para seguir, chips de tags.
6. **Busca** (`/busca?q=&tipo=&tag=`): campo do topo funcional (Ctrl K / ⌘K foca), filtros Tudo / Projetos / Perguntas / Pessoas, filtro por tag.
7. **Tag** (`/tags/[slug]`): projetos e perguntas da tag, botão Acompanhar/Deixar de acompanhar.

## Banco: migration `20261124100000_social.sql`

Só funções de leitura `security invoker` (a RLS de quem chama vale):

- `trending_projects(page_size int default 12)`: projetos visíveis ordenados por curtidas dos últimos 7 dias com peso por tempo (`sum(1 / (1 + idade_em_horas/24))`), empate por `likes_count` e mais novo.
- `suggested_profiles(page_size int default 5)`: perfis ativos com @, que não são quem chama nem já seguidos por ele, priorizando tecnologias em comum com o perfil de quem chama, depois seguidores. Visitante recebe os mais seguidos.

Versão escolhida para não colidir com a Moderação (subprojeto 7), que roda em paralelo.

## Abordagens consideradas

- **Leituras no app com o cliente do Supabase + duas funções SQL (escolhida).** Reaproveita `home_feed`/`search_content`, agrupamento de notificações em TypeScript puro (fácil de testar).
- Agrupar notificações e montar o feed em SQL (views/funções maiores): mais rápido em escala, mas mais código SQL para algo que a fase 1 não precisa.
- Feed pré-calculado: descartado pela spec (5.6).

## Fora do escopo

"Post com código", "Salvos" e aba "Menções" do Figma (não existem na spec nem no banco). Localização no perfil. Web Push e e-mail (fase 2). Aba "Para você" ranqueada: o feed é cronológico (spec 5.6).

## Decisões deixadas para quem constrói

Paginação das abas do perfil (20 itens, sem "mais" na fase 1); textos exatos em `messages/pt-BR.json`.
