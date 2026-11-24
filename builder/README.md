# Compilador de demos (GitHub Actions)

Transforma um repositório público do GitHub que precisa de build (React, Vite, Next com export estático, Vue, Astro, Angular, SvelteKit estático…) numa demo da Devsync, de graça: roda no GitHub Actions de um repositório **público** (sem cobrança de minutos). Design: [`docs/superpowers/specs/2026-11-24-devsync-build-de-demos-design.md`](../docs/superpowers/specs/2026-11-24-devsync-build-de-demos-design.md).

| Arquivo | O quê |
|---|---|
| `build-demo.yml` | Workflow. Vai em `.github/workflows/build-demo.yml` do repositório de builds (ex.: `GabrielPMachado/devsync-builds`). |
| `run.mjs` | Roda no runner: clona, instala e compila **dentro de um container Docker**, acha a pasta com `index.html`, compacta e envia. |
| `lib.mjs` | Funções puras (plano de build, pasta de saída, filtro de arquivos). Testes: `npx vitest run builder` na raiz. |

O workflow baixa `run.mjs` e `lib.mjs` da `main` deste repositório a cada build, então basta mesclar aqui para atualizar o compilador. Só o `build-demo.yml` precisa ser copiado (e de novo só se ele mudar).

## Etapas (o que o autor vê)

`queued` (na fila) → `cloning` → `installing` → `building` → `uploading` → `validating` (serviço de demos) → `ready`, ou `failed` com um código e o fim do log:

`clone_failed`, `no_package_json`, `no_build_script`, `install_failed`, `install_timeout` (6 min), `build_failed`, `build_timeout` (8 min), `no_output`, `next_server` (Next sem `output: 'export'`), `too_many_files` (500), `too_big` (60 MB, ou 25 MB compactado), `upload_failed`, `dispatch_failed`, `stalled` (sem notícia por 40 min, encerrado pelo cron do serviço de demos), `invalid_input`, `internal`, ou um motivo de recusa do zip (`no_index`, `extension_not_allowed`…).

## Segurança

- O código do autor só roda no container: usuário sem root, `--cap-drop ALL`, `no-new-privileges`, 6 GB de memória, 2 CPUs, 4096 processos. Nenhum segredo nem variável `ACTIONS_*` entra nele.
- O workflow só tem `permissions: id-token: write`. O token OIDC prova ao serviço de demos que o pedido vem deste workflow, na `main`, disparado por `workflow_dispatch`; o serviço prende cada build a um único run.
- Sem cache do Actions nem actions de terceiros no job: um build malicioso não deixa nada para o próximo. A saída do build vem depois de `::stop-commands::`, então não comanda o runner.
- A pasta de saída tem de estar dentro do projeto de verdade (sem link no caminho) e o `zip` roda com `-y`.
- Entradas do workflow vão por variável de ambiente e são validadas (`validateInputs`).
- Só arquivos comuns com as extensões aceitas vão para o zip (links simbólicos e ocultos ficam de fora), e o serviço de demos valida o zip de novo.

## Detecção

Gerenciador pelo campo `packageManager` do package.json, senão pelo lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, senão npm; pnpm e yarn via corepack). Framework pelas dependências; a pasta de saída é procurada na ordem do framework e depois `dist`, `build`, `out`, `.output/public` (`public` só para Gatsby) (também um nível abaixo, como `dist/<app>/browser` do Angular). Vite com `vite build` no fim do script recebe `--base=/` e CRA recebe `PUBLIC_URL=/`, porque a demo roda na raiz do subdomínio dela.

## Limites e cuidados

- O GitHub pode suspender contas que usam Actions para rodar código de terceiros de forma abusiva (mineração, por exemplo). Cada pessoa tem no máximo 5 demos por dia (limite do banco), e o build tem 25 min. Se aparecer abuso, a saída é exigir que o repositório seja do próprio autor ou mover o build para outro serviço.
- O workflow usa `run.mjs` da `main` deste repositório: quem pode mesclar aqui controla o compilador.
