# Lançamento da Devsync: passo a passo

O que já está pronto no código e o que só você pode fazer (comprar e criar contas). Siga na ordem.

## 1. Banco (Supabase)

No SQL Editor do projeto `devsync`, rode os arquivos da pasta `supabase/` do projeto, nesta ordem, cada um só uma vez:

1. `aplicar-moderacao.sql` (subprojeto 7), se ainda não rodou.
2. `aplicar-social.sql` (subprojeto 6), se ainda não rodou.
3. `aplicar-seguranca.sql` (este subprojeto). Pode rodar de novo sem problema; rode de novo se aplicar 1 ou 2 depois dele.

Depois, em **Advisors > Security Advisor**, os avisos "Public Can Execute SECURITY DEFINER Function" das funções de gatilho somem. Sobram, de propósito:

- `is_admin`, `is_active_user`, `content_is_visible`: usadas dentro das regras de acesso (RLS). Quem consulta precisa poder chamá-las. Só devolvem verdadeiro ou falso sobre quem está logado ou sobre um conteúdo.
- `admin_*`: só funcionam para admin (conferem o papel por dentro).
- `demo_uploads` sem política: tabela só do serviço de demos (chave `service_role`). Ninguém do site lê ou escreve nela.

**E-mail de login (obrigatório antes de abrir ao público, grátis).** O envio de e-mail padrão do Supabase só manda para quem é da equipe do projeto e poucas mensagens por hora: o link mágico não chegaria para os usuários. Crie uma conta grátis no [Resend](https://resend.com) (3 mil e-mails/mês), gere uma chave SMTP e preencha em **Authentication > Emails > SMTP Settings** (host `smtp.resend.com`, porta 465, usuário `resend`, senha = a chave). Sem domínio próprio, o Resend só envia do endereço de teste; com o domínio das demos ou do site, verifique o domínio no Resend.

Em **Authentication > URL Configuration**, confira que `https://devsync-br.vercel.app/**` está nas Redirect URLs.

## 2. Serviço de demos (Cloudflare, grátis)

Tudo no plano grátis da Cloudflare: o serviço fica em `devsync-demos.<seu-subdominio>.workers.dev` e cada demo numa pasta (`/d/<id>/`). Não precisa comprar nada.

Por que funciona no plano grátis: o site reempacota o zip "sem compressão" antes de enviar (e o build automático usa `zip -0`), então o Worker só recorta os arquivos, sem descompactar. Cabe nos 10 ms de CPU do plano grátis. Limite: zip de até 64 MB.

Segurança no modo pastas: as demos ficam num endereço diferente do site, então uma demo **não** consegue ler o login de quem visita a Devsync. O que fica compartilhado é entre demos: todas usam o mesmo endereço, então uma demo consegue ler o `localStorage` e os cookies de outra. Demos não guardam nada de importante, mas é o motivo para passar a um domínio próprio quando houver orçamento (seção 2.2).

1. **Conta.** Crie uma conta grátis em [dash.cloudflare.com](https://dash.cloudflare.com).
2. **R2.** Cloudflare > R2 Object Storage > ativar. Pede um cartão, mas não cobra dentro da cota grátis (10 GB).
3. **Subdomínio workers.dev.** Cloudflare > Workers & Pages > no canto direito, "Subdomain" > escolha um nome (ex.: `devsync`). As demos ficam em `devsync-demos.<nome>.workers.dev`.
4. **Token da API.** Cloudflare > My Profile > API Tokens > Create Token > modelo "Edit Cloudflare Workers". Acrescente **Account > Queues > Edit** e confira que **Account > Workers R2 Storage > Edit** está na lista. Em Zone Resources pode deixar "All zones" (o modo grátis não usa zona). Copie o token.
5. **ID da conta.** Cloudflare > Workers & Pages > no canto direito, "Account ID".
6. **No GitHub** (repositório > Settings > Secrets and variables > Actions):
   - Aba Variables: `WORKERS_SUBDOMAIN` = o nome do passo 3 (só o nome, ex.: `devsync`).
   - Aba Secrets:
     - `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` (passos 4 e 5)
     - `SUPABASE_SERVICE_ROLE_KEY`: Supabase > Project Settings > API Keys > `service_role` (secreta, nunca vai para o site)
     - `UPLOAD_SIGNING_SECRET`: um texto aleatório longo (ex.: o resultado de `openssl rand -hex 32`, ou 64 letras e números quaisquer)
     - `SAFE_BROWSING_API_KEY` (opcional): chave grátis da Google Safe Browsing API
7. **Publicar.** GitHub > Actions > "Publicar serviço de demos" > Run workflow, marcando **Criar bucket R2 e filas** na primeira vez. O workflow testa, publica com os segredos e confere que a API respondeu. No resumo da execução aparece o endereço para o passo 8.
8. **Ligar no site.** Vercel > projeto `devsync-app` > Settings > Environment Variables: `NEXT_PUBLIC_DEMOS_URL` = `https://devsync-demos.<nome>.workers.dev`. Depois, Deployments > o último > Redeploy. O site reconhece o `workers.dev` e usa o modo pastas sozinho (`NEXT_PUBLIC_DEMOS_MODE` só serve para forçar).

Pronto: publicar projeto com zip passa a funcionar em produção.

Se a publicação falhar citando `ratelimits`, o limite de chamadas por IP não está disponível na conta: apague o bloco `ratelimits` do ambiente `production` em `workers/demos/wrangler.jsonc` (o serviço funciona sem ele).

### 2.1 Build automático pelo GitHub (grátis)

Repositório do GitHub que precisa de build (React, Vite, Next com export estático…) vira demo sozinho: o serviço de demos dispara um GitHub Actions num repositório **público** só para isso (Actions em repositório público não cobra minutos). Detalhes em [`builder/README.md`](../builder/README.md). Faça depois do passo 2:

1. **Repositório de builds.** GitHub > New repository: nome `devsync-builds`, **Public**, com README. Crie o arquivo `.github/workflows/build-demo.yml` com o conteúdo de [`builder/build-demo.yml`](../builder/build-demo.yml) (Add file > Create new file, cole e faça commit na `main`).
2. **Token para disparar.** GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token: Repository access = **Only select repositories** > `devsync-builds`; Permissions > Repository > **Actions: Read and write**. Validade de 1 ano. Copie o token.
3. **No repositório da Devsync** (Settings > Secrets and variables > Actions): segredo `BUILDER_GITHUB_TOKEN` = o token; variáveis `BUILDER_REPO` = `GabrielPMachado/devsync-builds` e `BUILDER_REPO_ID` = o número `id` que aparece em `https://api.github.com/repos/GabrielPMachado/devsync-builds`. Rode de novo "Publicar serviço de demos".
4. **Ligar no site.** Vercel > Environment Variables: `NEXT_PUBLIC_DEMO_BUILDS` = `1` e Redeploy. Sem isso, o formulário continua só mostrando o aviso "precisa ser compilado".
5. **Banco.** Rode `aplicar-build-de-demos.sql` no SQL Editor (se ainda não estiver aplicado).

### 2.2 Domínio próprio para as demos (depois, com custo)

Cada demo no seu subdomínio (`<id>.<domínio>`), isolada das outras. Custa ~US$ 10/ano de domínio (Cloudflare Registrar) e US$ 5/mês de Workers Paid (mais CPU, para zips comprimidos grandes e mais folga).

1. Compre o domínio na Cloudflare e assine o Workers Paid.
2. **DNS curinga.** Cloudflare > o domínio > DNS > Add record: tipo `AAAA`, nome `*`, conteúdo `100::`, proxy ligado (nuvem laranja). Repita com nome `@`.
3. **Token.** No token do passo 4, em Zone Resources, inclua o domínio, e acrescente **Zone > Workers Routes > Edit**.
4. **GitHub.** Variável `DEMOS_DOMAIN` = o domínio (ex.: `devsyncdemos.com`). Ela ganha do `WORKERS_SUBDOMAIN`. Rode "Publicar serviço de demos" de novo.
5. **Vercel.** `NEXT_PUBLIC_DEMOS_URL` = `https://<domínio>` e Redeploy.

As demos já publicadas continuam valendo: os arquivos no R2 são os mesmos, só muda o endereço.

## 3. Conferência final

- Abra o site no celular e use "Adicionar à tela inicial": o ícone da Devsync aparece e o app abre em tela cheia.
- `https://devsync-br.vercel.app/sitemap.xml` e `/robots.txt` abrem.
- Cadastre o site no [Google Search Console](https://search.google.com/search-console) e envie o sitemap.
- Publique um projeto com zip e abra a demo.
- Importe do GitHub um projeto Vite e publique: as etapas do build aparecem e a demo abre no fim.

## O que fica para depois (com custo)

- Domínio próprio para as demos: seção 2.2.
- Domínio próprio para o site (hoje `devsync-br.vercel.app`): trocar `NEXT_PUBLIC_SITE_URL`, `SITE_URL` e `FRAME_ANCESTORS` do Worker e as Redirect URLs do Supabase.
- Notificações push no celular: o service worker já trata o evento; falta gerar as chaves VAPID e o envio pelo servidor.
- Filtro de tom com IA: `MODERATION_AI_ENABLED=true` e `ANTHROPIC_API_KEY` na Vercel.
