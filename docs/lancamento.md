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

## 2. Serviço de demos (Cloudflare)

O que você compra (só isto):

| O quê | Quanto | Onde |
|---|---|---|
| Domínio só para as demos (ex.: `devsyncdemos.com`) | ~US$ 10/ano | Cloudflare Registrar (preço de custo, já fica com o DNS na Cloudflare) |
| Workers Paid | US$ 5/mês | Cloudflare > Workers & Pages > Plans |

Por que um domínio separado: as demos rodam código de qualquer pessoa. Num domínio que não é o da Devsync, uma demo não consegue ler o login de quem visita.

Depois da compra:

1. **DNS curinga.** Cloudflare > o domínio > DNS > Add record: tipo `AAAA`, nome `*`, conteúdo `100::`, proxy ligado (nuvem laranja). Repita com nome `@` (o raiz).
2. **Token da API.** Cloudflare > My Profile > API Tokens > Create Token > modelo "Edit Cloudflare Workers". Acrescente a permissão **Account > Queues > Edit** e, em Zone Resources, escolha o domínio das demos. Copie o token.
3. **ID da conta.** Cloudflare > Workers & Pages > no canto direito, "Account ID".
4. **No GitHub** (repositório > Settings > Secrets and variables > Actions):
   - Aba Variables: `DEMOS_DOMAIN` = o domínio, sem `https://` (ex.: `devsyncdemos.com`).
   - Aba Secrets:
     - `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` (passos 2 e 3)
     - `SUPABASE_SERVICE_ROLE_KEY`: Supabase > Project Settings > API Keys > `service_role` (secreta, nunca vai para o site)
     - `UPLOAD_SIGNING_SECRET`: um texto aleatório longo (ex.: o resultado de `openssl rand -hex 32`, ou 64 letras e números quaisquer)
     - `SAFE_BROWSING_API_KEY` (opcional): chave grátis da Google Safe Browsing API
5. **Publicar.** GitHub > Actions > "Publicar serviço de demos" > Run workflow, marcando **Criar bucket R2 e filas** na primeira vez. O workflow testa, publica, grava os segredos e confere que a API respondeu.
6. **Ligar no site.** Vercel > projeto `devsync-app` > Settings > Environment Variables: `NEXT_PUBLIC_DEMOS_URL` = `https://<domínio>`. Depois, Deployments > o último > Redeploy (a política de segurança do site libera o domínio das demos durante o build).

Pronto: publicar projeto com zip passa a funcionar em produção.

## 3. Conferência final

- Abra o site no celular e use "Adicionar à tela inicial": o ícone da Devsync aparece e o app abre em tela cheia.
- `https://devsync-br.vercel.app/sitemap.xml` e `/robots.txt` abrem.
- Cadastre o site no [Google Search Console](https://search.google.com/search-console) e envie o sitemap.
- Publique um projeto com zip e abra a demo.

## O que fica para depois (com custo)

- Domínio próprio para o site (hoje `devsync-br.vercel.app`): trocar `NEXT_PUBLIC_SITE_URL`, `SITE_URL` e `FRAME_ANCESTORS` do Worker e as Redirect URLs do Supabase.
- Notificações push no celular: o service worker já trata o evento; falta gerar as chaves VAPID e o envio pelo servidor.
- Filtro de tom com IA: `MODERATION_AI_ENABLED=true` e `ANTHROPIC_API_KEY` na Vercel.
