# Devsync: design da arquitetura

**Data:** 2026-11-23
**Status:** rascunho para aprovação
**Autor do produto:** Gabriel (dev solo)

> Connect. Share. Develop.

## 1. Intenção

A Devsync é uma rede social para desenvolvedores que quer se tornar conhecida no mundo todo. O diferencial em relação a LinkedIn, GitHub, dev.to e Stack Overflow é juntar, num lugar só e com visual limpo:

1. **Projetos com demo funcionando.** A pessoa vê o projeto rodando dentro da Devsync, sem sair da página.
2. **Estudos em formato de perguntas e respostas**, no estilo do Stack Overflow, mas sem tela poluída, sem respostas velhas no topo e sem grosseria.
3. **Comentários e interação social** em volta dos dois: perfil, seguir, curtir e notificações.

A estratégia de crescimento é começar simples e bem organizado: conquistar os primeiros milhares de usuários com uma experiência excelente nessas três peças, e só depois investir em infraestrutura pesada.

## 2. Objetivos, não objetivos e anti-objetivos

### Objetivos (lançamento)
- Publicar um projeto com demo web (link ou arquivos enviados) que abre numa camada por cima do feed.
- Fazer perguntas, responder, votar, aceitar resposta e organizar por tags.
- Comentar em projetos, perguntas e respostas.
- Perfil profissional com habilidades e tecnologias, seguir pessoas e receber notificações.
- Feed e busca que ajudem a descobrir projetos, perguntas e pessoas.
- Páginas públicas indexáveis pelo Google (perguntas e projetos são a principal porta de entrada).
- Site instalável como app (PWA).

### Não objetivos (por enquanto)
- Rodar código na Devsync (executar no navegador do visitante ou em nossos servidores).
- Preview de apps mobile.
- Interface e conteúdo em inglês.
- Mensagens privadas (chat), vagas de emprego e monetização.
- App Windows (Tauri) no dia do lançamento: ele vem na fase 2.

### Anti-objetivos (seria fracasso mesmo funcionando)
- Tela poluída, com barras laterais, medalhas e números por todo lado.
- Respostas antigas e erradas aparecendo como a solução certa.
- Ambiente hostil com iniciantes.
- Uma demo maliciosa conseguir roubar a sessão ou os dados de quem está logado.
- Gastar meses em infraestrutura antes de ter usuários.

## 3. Restrições

- **Uma pessoa programando.** Tudo precisa ser gerenciado (sem servidor próprio para manter) e em TypeScript, a linguagem que o Gabriel já usa (React, Expo, Firebase, Astro).
- **Custo baixo no começo** e que cresça de forma previsível com o uso.
- **Idioma:** nasce em português do Brasil. O inglês vem depois, então os textos da interface não podem ficar espalhados direto no código.
- **Identidade visual:** fundo escuro, azul e ciano, minimalista. A logo já existe (colchetes `< >` em hexágono com gradiente azul→ciano).

## 4. Abordagens consideradas

| | Abordagem | Prós | Contras |
|---|---|---|---|
| A | Next.js + Firebase | Começo mais rápido, o Gabriel já domina | Custo por leitura encarece o feed, sem busca de texto, relações (seguidores, comentários em árvore) ficam difíceis |
| **B** | **Next.js + Supabase (Postgres)** | Igual ao Firebase em praticidade (auth, storage, realtime), mas com SQL: feed, seguidores, busca e contadores saem naturalmente; banco portátil | Exige aprender um pouco de SQL |
| C | Next.js + API própria (NestJS, Postgres, Redis) | Controle total | Trabalho de equipe, atrasa o lançamento em meses |

**Escolhida: B.** É quase tão rápido de começar quanto o Firebase e não vira gargalo quando a rede crescer. Como é Postgres, o banco pode migrar para outro provedor sem reescrever o sistema.

Para as demos, consideramos três níveis: (1) só link e mídia, (2) demo embutida na página, (3) código rodando na Devsync. **Escolhido: nível 2**, com duas entradas (link ou arquivos de site pronto). O modelo de dados já prevê o nível 3 e o mobile.

Para o app de Windows, consideramos PWA, Tauri e Electron. **Escolhido: PWA no lançamento e Tauri na fase 2**, com o mesmo código do site.

## 5. Arquitetura

### 5.1 Visão geral

```
                    ┌──────────────────────────┐
  Navegador / PWA ─▶│  devsync.app (Next.js)   │── Vercel
  App Tauri (fase 2)│  páginas + rotas de API   │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  Supabase                │
                    │  Postgres · Auth ·       │
                    │  Storage · Realtime ·    │
                    │  Edge Functions          │
                    └────────────┬─────────────┘
                                 │ envio de .zip validado
                    ┌────────────▼─────────────┐
  iframe isolado ──▶│  *.devsync-demos.app     │── Cloudflare R2 + Worker
                    │  (domínio separado)      │
                    └──────────────────────────┘
```

- **Frontend e páginas:** Next.js (App Router) com React e TypeScript, hospedado na Vercel. Perguntas, projetos e perfis renderizados no servidor para SEO.
- **Backend:** Supabase. Postgres com Row Level Security (RLS) como a principal barreira de permissão. Edge Functions para o que não cabe no banco (validar zip de demo, chamar a IA de moderação).
- **Demos enviadas:** Cloudflare R2 (armazenamento) e um Cloudflare Worker que serve os arquivos em `<slug>.devsync-demos.app`.
- **Mídia (avatares, imagens de post):** Supabase Storage.

### 5.2 Domínio separado para demos (segurança)

Toda demo enviada é servida em `<slug>.devsync-demos.app`, um domínio registrado à parte e diferente de `devsync.app`. Isso impede que um JavaScript malicioso leia cookies, o localStorage ou a sessão da Devsync.

- O iframe usa `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"` (sem `allow-top-navigation`). O `allow-same-origin` é necessário para SPAs funcionarem (localStorage, IndexedDB, fetch). Ele é seguro aqui porque a origem da demo é outro domínio, nunca `devsync.app`.
- Cada demo tem subdomínio próprio, para o armazenamento de uma demo não ser lido por outra.
- O Worker envia CSP com `frame-ancestors https://devsync.app` e só serve o HTML principal quando o pedido vem de um iframe (`Sec-Fetch-Dest: iframe`). Aberta direto no navegador, a URL da demo redireciona para `devsync.app/demo/<id>`, uma página da Devsync em tela cheia com a demo embutida e o aviso "conteúdo enviado por usuário". Assim `devsync-demos.app` não vira hospedagem livre para páginas de phishing.
- O botão "Abrir em nova aba" abre essa página `devsync.app/demo/<id>`, não a URL crua.
- Envio de demo exige conta com e-mail verificado ou login pelo GitHub, e tem limite de envios por dia (inicial: 5).

### 5.3 Demos

**Tipos** (campo `demo_kind` no projeto): `web_link`, `web_upload`. No futuro: `sandbox` (código rodando no navegador) e `mobile` (versão web em moldura de celular ou QR code).

**Link (`web_link`):**
- O autor cola uma URL https.
- Uma verificação no servidor checa se o site aceita ser embutido (cabeçalhos `X-Frame-Options` e `frame-ancestors`). Muitos sites bloqueiam. Nesse caso, a demo mostra a imagem de capa enviada pelo autor (campo obrigatório no projeto) com o botão "Abrir em nova aba", que abre o site dele. Captura de tela automática fica para depois.
- A URL passa por uma checagem de site perigoso (Google Safe Browsing) antes de publicar.

**Arquivos enviados (`web_upload`):**
- O autor envia um `.zip` com um site pronto (HTML, CSS, JS e assets, por exemplo a pasta `dist` de um projeto Vite).
- Limites iniciais: até 25 MB compactado, 500 arquivos, `index.html` obrigatório na raiz ou numa única pasta, apenas extensões de site estático (lista permitida).
- O fluxo: envio direto para o R2 por URL assinada → um Cloudflare Worker (via fila) valida e descompacta, porque Edge Functions do Supabase têm limite de CPU e memória baixo para isso → os arquivos ficam em `demos/<demo_id>/<versão>/` → o Worker avisa o Supabase e a demo é publicada.
- Cada novo envio cria uma versão nova. A anterior pode ser apagada depois de um tempo.

**Experiência:** o botão "Ver demo" abre uma camada sobre o feed (sobreposição em tela quase cheia) com o iframe, o link "Abrir em nova aba", o link do código (repositório) e o acesso aos comentários e às perguntas relacionadas.

**Moderação de demos:** botão de denúncia, possibilidade de suspender a demo na hora (o Worker deixa de servir o conteúdo) e lista de bloqueio de domínios.

### 5.4 Estudos (perguntas e respostas)

- Pergunta: título, texto em Markdown (com blocos de código destacados), tags (1 a 5), projeto relacionado opcional.
- Resposta: texto em Markdown, demo opcional (mesmo sistema da seção 5.3), versão de tecnologia opcional ("React 19").
- Votos positivos em respostas. **Pergunta não recebe voto negativo.** Resposta pode receber voto negativo, mas ele só reduz a ordem e nunca aparece como número negativo em destaque. A pontuação é votos positivos menos negativos.
- Só o autor edita o próprio conteúdo. Cada edição guarda uma revisão (tabela `revisions`). Editar uma resposta zera as marcações de "não funciona mais".
- O autor da pergunta marca a resposta aceita.

**Contra respostas antigas:**
- Toda resposta guarda a data e a versão da tecnologia.
- Respostas com mais de 2 anos mostram o aviso discreto "pode estar desatualizada".
- Qualquer usuário logado pode marcar "não funciona mais". Com 3 marcações, o aviso fica mais visível.
- A ordem das respostas:
  1. A aceita fica em primeiro, a não ser que uma resposta publicada depois dela tenha pontuação de pelo menos 5 e pelo menos o dobro da aceita. Nesse caso, a mais nova sobe com o selo "mais votada recentemente".
  2. As demais seguem por pontuação. Em empate, a mais nova vem antes.
  3. Respostas com 3 ou mais marcações de "não funciona mais" descem para depois das que não têm marcação.
  4. Sem resposta aceita, vale a regra 2 e 3.

**Contra grosseria:**
- Em vez de voto negativo na pergunta, existe a ação "precisa de mais detalhes", que envia ao autor uma mensagem educada com um modelo de como melhorar.
- Antes de publicar um comentário ou uma resposta, uma Edge Function chama um modelo de IA (Claude Haiku) para classificar o tom. Se o texto soar agressivo, a pessoa vê um aviso e pode reescrever. O filtro **avisa, mas não bloqueia**. A denúncia continua disponível para todos.
- Perguntas repetidas não são fechadas. Recebem o link "veja também" para a pergunta original.
- A tag `iniciante` aparece com destaque e lembra quem responde de ter paciência.

**Contra tela poluída:** a página da pergunta mostra título, tags, texto, a resposta aceita e as demais respostas. Reputação, histórico de edição e estatísticas ficam atrás de um clique. Sem barras laterais de propaganda ou listas de "perguntas em alta".

### 5.5 Social

- **Perfil:** nome, @usuário, foto, bio, tecnologias (escolhidas das tags), links (GitHub, site), projetos, perguntas e respostas.
- **Seguir:** relação unidirecional (como no X ou no GitHub), sem pedido de amizade.
- **Curtidas** em projetos. **Votos** em respostas.
- **Comentários** em projetos, perguntas e respostas, com resposta a um comentário em até 2 níveis (não vira árvore infinita).
- **Notificações:** na própria Devsync, em tempo real (Supabase Realtime). Eventos: novo seguidor, comentário, resposta na sua pergunta, resposta aceita, curtida ou voto (agrupados, por exemplo "Ana e mais 4 curtiram"). Na fase 1, a notificação aparece com a Devsync aberta (aba ou app instalado). Notificação com o app fechado (Web Push) e resumo semanal por e-mail ficam para a fase 2.

### 5.6 Feed e descoberta

- **Início:** projetos e perguntas de quem você segue e das tags que você acompanha, em ordem cronológica. Montado com consulta no Postgres na hora da leitura, com índices certos. Isso aguenta bem dezenas de milhares de usuários. Feed pré-calculado e ranqueado fica para quando houver necessidade medida.
- **Explorar:** projetos em alta (curtidas recentes com peso por tempo) e perguntas sem resposta.
- **Busca:** busca de texto do Postgres (configuração `portuguese`) em perguntas, projetos e perfis, com filtro por tag. Um serviço de busca dedicado (Meilisearch, Typesense) fica para quando o Postgres não der conta.

### 5.7 Autenticação

- Supabase Auth com **login pelo GitHub** (principal, porque o público é dev) e **e-mail com link mágico**.
- O @usuário é escolhido no primeiro acesso.
- Sessão em cookie, compatível com a renderização no servidor do Next.js.

### 5.8 Modelo de dados (resumo)

```
profiles(id, username, display_name, avatar_url, bio, links, locale,
         role[user|admin], suspended_at?, created_at)
follows(follower_id, followee_id, created_at)
tags(id, slug, name, description)
profile_tags(profile_id, tag_id)
tag_follows(profile_id, tag_id)

projects(id, author_id, title, slug, description_md, repo_url, cover_url,
         demo_id, lang, created_at, updated_at)
project_tags(project_id, tag_id)
likes(profile_id, project_id, created_at)

demos(id, owner_id, kind[web_link|web_upload|sandbox|mobile], url,
      storage_prefix, version, status[pending|live|blocked], embeddable,
      screenshot_url, created_at)

questions(id, author_id, title, slug, body_md, project_id?, accepted_answer_id?,
          lang, created_at, updated_at)
question_tags(question_id, tag_id)
answers(id, question_id, author_id, body_md, demo_id?, tech_version?,
        score, outdated_flags, created_at, updated_at)
answer_votes(profile_id, answer_id, value[+1|-1])
outdated_flags(profile_id, answer_id, created_at)
detail_requests(profile_id, question_id, created_at)

revisions(id, target_type, target_id, editor_id, body_md, created_at)

comments(id, author_id, target_type[project|question|answer], target_id,
         parent_id?, body_md, created_at)

notifications(id, recipient_id, type, actor_id, target_type, target_id,
              read_at, created_at)
reports(id, reporter_id, target_type, target_id, reason, status, created_at)
```

- Todo conteúdo tem `lang` (hoje sempre `pt-BR`), para o inglês entrar sem migrar dados.
- Contadores (curtidas, votos, respostas) mantidos por gatilhos (triggers) no Postgres.
- Busca: coluna `tsvector` gerada em perguntas, projetos e perfis, com índice GIN.

### 5.9 Interface

- Next.js com Tailwind CSS e componentes próprios no estilo da marca (fundo escuro, azul `#2563EB`→ciano `#22D3EE`, aproximado da logo).
- Markdown renderizado com destaque de código (Shiki).
- Todos os textos da interface num arquivo de tradução (`next-intl`), mesmo só com português, para o inglês entrar depois sem caçar texto no código.
- URLs sem prefixo de idioma para o português (`/perguntas/...`). O inglês entra depois com `/en/...`, então nenhuma URL já indexada muda.
- PWA: manifest, ícones gerados da logo e service worker para notificações.

### 5.10 App Windows (fase 2)

- Tauri envolvendo o site da Devsync.
- Recurso exclusivo: **"Publicar demo a partir da pasta"**. O autor escolhe a pasta de build do projeto, o app compacta e envia pelo mesmo fluxo da seção 5.3.
- Ícone na bandeja com notificações. Atualização automática do Tauri.

## 6. Fases

**Fase 1, lançamento (web + PWA, pt-BR)**
1. Base: Next.js, Supabase, autenticação, perfis, tags, layout da marca.
2. Projetos com demo por link e por zip, domínio de demos, camada de visualização.
3. Perguntas, respostas, votos, aceitar resposta, avisos de desatualização.
4. Comentários, curtidas, seguir, notificações em tempo real.
5. Feed, explorar e busca.
6. Moderação: denúncia, "precisa de mais detalhes", filtro de tom com IA, suspensão de demo. Papel `admin` no perfil e uma página simples `/admin` com a fila de denúncias e ações de ocultar conteúdo, suspender demo e suspender conta. No início, o moderador é o Gabriel.
7. PWA, SEO (metadados e sitemap), testes, segurança, lançamento.

**Fase 2:** app Windows (Tauri) com publicação a partir da pasta, resumo semanal por e-mail, build do código-fonte da demo pela Devsync.

**Fase 3 em diante:** inglês, demos que rodam no navegador do visitante (Sandpack/WebContainers) para frontend, preview de apps mobile (versão web em moldura de celular e QR code), mensagens privadas, vagas. Execução de código em servidor só quando houver receita.

## 7. Decisões tomadas pelo Gabriel
- Produto real com ambição mundial, não projeto de portfólio.
- Centro: demos, estudos estilo Stack Overflow (sem poluição, sem respostas antigas no topo, sem grosseria) e comentários.
- Demo nível 2: link embutido ou arquivos enviados, abrindo por cima da rede. Mobile fica para o futuro.
- Supabase como backend.
- App Windows com Tauri.
- Nasce em pt-BR.

## 8. Decisões técnicas propostas por mim (revisar)
- Next.js na Vercel, Tailwind, next-intl, Shiki.
- Cloudflare R2 + Worker para as demos, em domínio separado.
- Login pelo GitHub e por link mágico.
- Seguir unidirecional, comentários com 2 níveis.
- Feed cronológico montado na leitura. Busca com o próprio Postgres.
- Filtro de tom com Claude Haiku que avisa e não bloqueia.
- Limites de demo: 25 MB, 500 arquivos.
- Regras de "desatualizada": 2 anos, 3 marcações, e a regra do dobro de votos (mínimo 5).
- `allow-same-origin` no iframe, demo aberta fora do iframe redireciona para a página da Devsync, limite de 5 envios por dia.
- Descompactar demos num Cloudflare Worker, não numa Edge Function.
- Moderação pelo Gabriel numa página `/admin` simples.
- Web Push só na fase 2.
- Imagem de capa do projeto enviada pelo autor, usada quando o site não aceita ser embutido.
- Só o autor edita, com histórico de revisões.
- URLs sem prefixo para português.

## 9. Fica a critério de quem constrói
- Estrutura de pastas do repositório e organização dos componentes.
- Ferramentas de teste (sugestão: Vitest e Playwright) e CI no GitHub Actions.
- Detalhes das políticas de RLS, índices e migrações.
- Ajustes finos de layout, desde que respeitem a identidade visual.
