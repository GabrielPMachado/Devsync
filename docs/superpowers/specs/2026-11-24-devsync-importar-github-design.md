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
