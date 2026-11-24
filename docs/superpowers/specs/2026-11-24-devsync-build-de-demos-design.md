# Build automático de demos pelo GitHub — design

Data: 2026-11-24. Pedido: projetos importados do GitHub que precisam de build (React/Vite/Next…) hoje mostram "precisa ser compilado". A Devsync deve compilar sozinha, a custo US$ 0, e mostrar o progresso para quem publica.

## Objetivos
- Repo público com `package.json` e script `build` vira demo sem o autor fazer nada.
- Progresso por etapas no formulário: na fila, baixando o código, instalando, compilando, enviando, validando, pronto (ou erro com o log resumido).
- Custo zero: GitHub Actions em repositório público não cobra minutos.

## Não objetivos
- Sites com servidor (Next sem `output: 'export'`, APIs). Recebem um erro claro.
- Repos privados, monorepos (só a raiz), variáveis de ambiente do autor.
- Rebuild automático a cada push (fica para depois).

## Abordagens
1. **GitHub Actions num repo público separado (escolhida).** Grátis e sem limite de minutos; o Worker dispara por `workflow_dispatch`. Isolado do repo da Devsync.
2. Actions no próprio repo da Devsync. Mesmo custo, mas código de terceiros rodando no repo principal pode envenenar o cache do CI e ver o token do repo. Descartada.
3. Build no navegador (WebContainers) ou serviços pagos (Vercel/Netlify API, Cloud Build). Licença comercial/limites ou custo. Descartadas.

## Como funciona
1. Formulário (`/projetos/novo`): importação acha `needs_build` (index.html com .tsx/.jsx ou `package.json` sem site pronto). Em vez do aviso, mostra "Vamos compilar na nuvem quando você publicar".
2. Publicar → `POST /builds { repo }` no serviço de demos (Bearer do Supabase). O Worker confere o repo no GitHub (público, existe, ≤ 200 MB), cria a demo `web_upload` **como o usuário** (limite de 5 por dia e e-mail confirmado valem), cria a linha `demo_builds` (service_role) e dispara o workflow `build-demo.yml` do repo `BUILDER_REPO` com `{ build_id, repo, ref, api }`.
3. Workflow (`builder/` neste repo, copiado para o repo de builds):
   - Um único job, `permissions: id-token: write` e nada mais. Sem segredos.
   - Script Node sem dependências (`builder/run.mjs`) no runner: clona (`--depth 1`, sem hooks, sem LFS), detecta gerenciador (npm/pnpm/yarn) e framework, roda **instalação e build dentro de um container Docker** (`node:22`, usuário sem root, `--cap-drop ALL`, `no-new-privileges`, limites de memória/CPU/processos, tempo: 6 min instalação, 8 min build). O token OIDC nunca entra no container.
   - Acha a pasta com `index.html` (por framework e depois dist/build/out/.output/public/public), filtra pelas extensões aceitas, ignora links simbólicos, confere 500 arquivos / 60 MB, compacta (≤ 25 MB).
   - Vite com `vite build` no fim do script recebe `--base=/` (a demo roda na raiz do subdomínio). CRA recebe `PUBLIC_URL=/`.
   - Cada etapa é avisada ao Worker: `POST /builds/:id/progress` e no fim `PUT /builds/:id/zip`, autenticados com o **token OIDC do GitHub Actions** (audiência `devsync-builds`).
4. Worker valida o JWT (chaves públicas do GitHub, `iss`, `aud`, `exp`, `repository = BUILDER_REPO`, `workflow_ref` = `build-demo.yml` na `main`, `event_name = workflow_dispatch`) e prende o build ao primeiro `run_id` que falar com ele. Grava o zip em `uploads/<demo>/<versão>.zip` e enfileira a mesma validação dos zips enviados à mão.
5. Banco: tabela `demo_builds` (dono lê pela RLS; só o serviço escreve). Gatilho em `demos`: `live` → build `ready`; `unavailable`/`blocked` → build `failed` com o motivo. Falha no build marca a demo `unavailable` com `rejection_reason = 'build_failed'`.
6. O formulário consulta a linha do build a cada 2 s (sem Realtime, menos peças) e mostra a lista de etapas; acabou em `ready` → publica o projeto. Sem novidade por 20 min → "o build demorou demais".

## Segurança
- Código do autor só roda no container, sem segredos nem token OIDC. Entradas do workflow passam por variáveis de ambiente e são validadas por regex (sem `${{ }}` dentro de scripts).
- Nenhum cache do Actions no repo de builds (um build malicioso não envenena o próximo).
- Um token OIDC só vale para o próprio run; o run só escreve no build que ele assumiu primeiro. Um build malicioso no máximo troca a própria demo, o que o autor já pode fazer enviando um zip.
- O zip passa pela mesma validação de sempre (caminhos, extensões, tamanho, link simbólico).
- Token do GitHub no Worker (`BUILDER_GITHUB_TOKEN`): fine-grained, só o repo de builds, permissão Actions: write.

## Configuração (no lançamento)
- Criar repo público `devsync-builds` e copiar `builder/build-demo.yml` para `.github/workflows/`.
- Segredo `BUILDER_GITHUB_TOKEN` e var `BUILDER_REPO` no Worker.
- Só funciona depois que o serviço de demos estiver publicado na Cloudflare.

## Chamadas que fiz sozinho
- Consulta a cada 2 s em vez de Realtime.
- Next sem export estático: erro `next_server` com instrução de adicionar `output: 'export'`.
- Bun: tratado como npm.

## Ajustes da revisão de código
- Cron a cada 15 min no Worker encerra builds sem notícia há 40 min (`stalled`); run com entradas inválidas ainda avisa `invalid_input`.
- Branch padrão também passa pela regex; recarga forçada das chaves do GitHub limitada a 1 por minuto; `BUILDER_REPO_ID` opcional prende o token ao id do repositório.
- Reenvio do zip depois de resposta perdida segue a validação em vez de falhar.
- Pasta de saída só dentro do projeto (sem link no caminho), `zip -y`, `::stop-commands::` antes do build, sem actions de terceiros no job.
- `public`/`docs` deixam de ser pastas de saída genéricas (só Gatsby); `packageManager` do package.json manda mais que o lockfile.
