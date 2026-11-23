# Devsync subprojeto 4: Projetos (design curto)

**Pedido:** publicar projeto com demo (link ou zip), página do projeto, camada de demo `<DemoOverlay>` por cima da página (nunca outra guia), curtidas e comentários. Entrega testável: E2E publicar com zip e abrir a demo na camada.

**Base que já existe na `main`:** tabelas `projects`, `demos`, `project_tags`, `likes`, `comments` com RLS e gatilhos (subprojeto 1); serviço de demos `workers/demos` (subprojeto 3); login, `@usuário` e moldura do site (subprojeto 2). Telas aprovadas no Figma: 03 Demo (preparando, ao vivo, tela cheia, indisponível, suspensa), 04 Projeto, 04b Projeto publicado, 05 Publicar projeto (formulário, validando, link bloqueado).

## Objetivos

- Qualquer pessoa logada (e-mail confirmado ou GitHub) publica um projeto com demo enviada (.zip) ou por link.
- Visitantes veem a lista de projetos, a página do projeto e abrem a demo na camada.
- Logados curtem e comentam (2 níveis: comentário e resposta).

## Não objetivos (ficam para outros subprojetos)

Feed do início, seguir, "Salvar", busca, perguntas relacionadas (6); denúncia e suspensão (7); "visitas na demo"; rascunhos; editar projeto (só apagar por enquanto); curtir comentário (não existe tabela).

## Anti-objetivos

- Demo abrindo em outra guia, ou botão para isso.
- Tela branca quando a demo está indisponível ou suspensa.
- Projeto publicado com demo que ainda não validou ou foi recusada.

## Abordagens consideradas

1. **Projeto só é criado depois da demo validar (escolhida).** O navegador cria a demo no Worker, envia o zip, pede a validação e espera `demos.status` virar `live` ou `unavailable`; só então o servidor cria o projeto. Erros do zip aparecem no formulário, sem projeto quebrado no ar. É o fluxo do Figma ("Validando…" → "Projeto publicado! A demo já está no ar.").
2. Criar o projeto na hora com a demo `pending`. Mais rápido para quem publica, mas deixa projetos com demo recusada visíveis e exige tela de correção. Descartada.
3. Enviar o zip pelo servidor do Next. Passa 25 MB pela Vercel (limite de 4,5 MB no corpo) e duplica o que o Worker faz. Descartada.

## Como fica

- **Rotas:** `/projetos` (lista, mais novos primeiro), `/projetos/novo` (publicar), `/projetos/[slug]` (página), `/demo/[id]` (página em tela cheia, destino do redirecionamento do Worker quando a demo é aberta fora do iframe, com o aviso "conteúdo enviado por usuário"). O botão "Publicar" da barra vai para `/projetos/novo`.
- **Camada:** `<DemoOverlay demoId onClose />` (componente cliente). Aberta pelo parâmetro `?demo=<id>` na própria página, assim o botão Voltar fecha e o link pode ser compartilhado. Barra com autor, título e selo de status, larguras (computador, tablet, celular), recarregar, tela cheia (Fullscreen API no próprio elemento, ainda dentro da Devsync), comentários (vai para a página do projeto) e fechar (X, Esc, clique fora). Estados `pending` (consulta de novo a cada 2 s), `live`, `unavailable` e `blocked` com os textos do Figma. Iframe com `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"`, `src` = `https://<id>.<DEMOS_HOST>/` (zip) ou a URL (link).
- **Publicar:** Sobre (título, descrição em Markdown, 1 a 5 tags), Demo (Enviar arquivos | Link do site), Links (repositório, site). Zip: `POST /uploads` → `PUT uploadUrl` → `POST /complete` → espera o status (até 90 s) → server action cria o projeto e as tags → página do projeto com o aviso de publicado. Link: `POST /embed-check`; se bloquear, mostra o aviso com as duas saídas; senão cria a demo `web_link`, `POST /demos/:id/verify`, cria o projeto. Motivos de recusa traduzidos em `messages/pt-BR.json`.
- **Curtidas:** botão com contador, server action insere/apaga em `likes` (RLS e contador do banco).
- **Comentários:** lista em 2 níveis na página do projeto, formulário, responder, apagar o próprio. Server actions; a RLS valida.
- **Markdown:** `react-markdown` + `remark-gfm`, sem HTML cru.
- **Banco:** nenhuma migration nova prevista; o schema do subprojeto 1 cobre tudo. Se precisar, numerar depois de conferir a `main` (a thread de Estudos cria migrations em paralelo).
- **Variável:** `NEXT_PUBLIC_DEMOS_URL` (ex.: `http://demos.localhost:8787`, na produção `https://<DEMOS_HOST>`). A API do Worker fica nela, e cada demo em `<protocolo>//<id>.<host>/`.

## Testes

- Vitest: regras puras (validação do formulário, montagem da URL da demo, tradução dos motivos, árvore de comentários) e componentes (DemoOverlay em cada estado, Esc fecha, nunca `target=_blank`).
- E2E (Playwright) contra Supabase local + `wrangler dev` do Worker: entrar → publicar com zip → página do projeto → "Abrir demo" → camada com o iframe mostrando o site do zip → Esc fecha. Mais: curtir e comentar.
- CI: o job do site sobe o Worker (`wrangler dev`) com `.dev.vars` apontando para o Supabase local.

## A critério de quem constrói

Visual fino segue o Figma; textos em `messages/pt-BR.json`.
