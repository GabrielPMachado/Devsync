# Importar projeto do GitHub — design

Aprovado por Demonity em 2026-11-24 (thread "Importar projetos do GitHub").

## Intenção
Publicar um projeto na Devsync dá trabalho: título, descrição, assuntos, links e demo são digitados à mão.
Quase todo projeto já está no GitHub. Ao publicar, a pessoa escolhe um repositório e a Devsync preenche o formulário.

## Objetivos
- Botão "Importar do GitHub" no topo de `/projetos/novo` que abre a lista dos repositórios públicos da pessoa (mais recentes primeiro, com busca).
- Escolher um repositório preenche: título (nome do repo), descrição (README; se não houver ou passar do limite, a descrição do repo), link do repositório, assuntos (tópicos e linguagens que existem na lista de assuntos da Devsync, até 5), site (homepage https). Se houver homepage https, ela vira o link da demo (modo "link").
- A pessoa revisa e publica pelo fluxo de hoje (validações e demo continuam iguais).

## Não objetivos
- Repositórios privados (exigiria escopo `repo` no login).
- Importar vários de uma vez, sincronizar depois, webhooks.
- Mudar o banco.

## Restrições
- US$ 0: API pública do GitHub chamada do navegador (limite de 60 pedidos/h por IP sem token; listar = 1 pedido, escolher = 2).
- CSP: incluir `https://api.github.com` em `connect-src`.
- Nada de HTML cru: o README entra como markdown; o componente Markdown já ignora HTML e imagens. Links relativos do README viram links absolutos do GitHub.

## Abordagens
1. **Navegador chama a API pública (escolhida).** Sem servidor, sem token, sem custo; o limite por IP é de quem está usando.
2. Rota do servidor com token da Devsync: limite maior (5.000/h), mas um token secreto a guardar e todo mundo divide o mesmo limite.
3. Token OAuth do login com GitHub (`provider_token`): daria repos privados, mas o Supabase não guarda o token depois do login e pedir `repo` assusta.

## Decisões
- Usuário do GitHub: `profiles.links.github`; senão o `user_name` do login com GitHub; a pessoa pode trocar o nome no painel.
- Forks ficam fora da lista.
- Mapeamento de assuntos: nome em minúsculas, com apelidos (`reactjs`→`react`, `golang`→`go`, `tailwind`→`tailwindcss`, `nodejs`→`backend`, `plpgsql`/`tsql`→`sql`, `scss`→`css`, …), só os que existem na lista, tópicos antes de linguagens (linguagens por bytes), até 5.
- Erros: usuário não existe, limite do GitHub estourado (mostra a hora de voltar) e falha de rede aparecem no painel, sem travar o formulário.

## Para quem implementa
- Lógica pura em `src/lib/projects/github.ts` (fetch injetável, testes com Vitest).
- Painel em `src/components/projects/github-import.tsx`; `PublishServices` ganha `github`.

## Parte 2: demo a partir dos arquivos do repositório (2026-11-24)

Pedido de Demonity depois de testar: "ele não puxou os arquivos do GitHub". Escolheu: os arquivos do repo viram a demo.

- Quando o repo não tem homepage https, a importação procura um site pronto: branch `gh-pages` (raiz), senão na branch padrão as pastas `dist/`, `build/`, `docs/`, `out/` e por fim a raiz. Vale a primeira com `index.html`.
- Se o `index.html` aponta para código que precisa compilar (`src="/src/main.tsx"` e afins), não serve: mensagem explicando (rodar o build e publicar em `gh-pages`, ou enviar o .zip da pasta `dist`).
- No envio, o navegador baixa os arquivos (raw.githubusercontent.com, que libera CORS; o zip pronto do GitHub não libera), monta o .zip (fflate) e segue o fluxo de upload de hoje. O Worker não muda.
- Só extensões aceitas pelo serviço de demos; ignora pastas/arquivos ocultos e `node_modules`. Limites: 500 arquivos, 60 MB somados; o zip final ainda passa pelo limite de 25 MB.
- Custo extra: 1 a 2 pedidos à API (árvore de arquivos); os downloads não contam no limite da API.
- Abordagens descartadas: Worker baixar o zip do repo (exige mudar e publicar o Worker, que nem está no ar); compilar o projeto (GitHub Actions/servidor de build) fica para o futuro.
