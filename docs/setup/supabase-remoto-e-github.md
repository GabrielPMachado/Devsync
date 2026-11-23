# Ligar o login de verdade: Supabase remoto e app OAuth do GitHub

Tudo no plano gratuito. Leva uns 15 minutos. Onde aparecer `<ref>`, use o código do
seu projeto Supabase (está na URL do painel: `supabase.com/dashboard/project/<ref>`).

## 1. Criar o projeto no Supabase

1. Entre em https://supabase.com/dashboard e clique em **New project**.
2. Nome `devsync`, região **South America (São Paulo)**, plano **Free**. Guarde a senha do banco.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable**.

## 2. Criar o app OAuth do GitHub

1. Abra https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Preencha:
   - **Application name:** Devsync
   - **Homepage URL:** o endereço do site (ex.: `https://devsync.vercel.app`; enquanto não tiver, `http://localhost:3000`)
   - **Authorization callback URL:** `https://<ref>.supabase.co/auth/v1/callback`
3. Clique em **Register application**, depois em **Generate a new client secret**. Copie o **Client ID** e o **Client secret**.

## 3. Ligar o GitHub no Supabase

**Authentication → Sign In / Providers → GitHub**: ative, cole o Client ID e o Client secret e salve.

## 4. Endereços permitidos

**Authentication → URL Configuration**:

- **Site URL:** o endereço de produção (ex.: `https://devsync.vercel.app`).
- **Redirect URLs:** adicione `http://localhost:3000/**` e `https://devsync.vercel.app/**` (ou o seu domínio).

Sem isso o link do e-mail quebra: o Supabase troca o endereço de retorno pelo Site URL.

## 5. E-mails em português

**Authentication → Emails → Templates**. Em **Magic link** e em **Confirm signup**:

- **Subject:** `Seu link de acesso à Devsync`
- **Body:** cole o conteúdo de `supabase/templates/magic_link.html` (o mesmo nos dois).

O link do template usa `{{ .RedirectTo }}`, que o site sempre manda com `?next=`. Não troque por `{{ .ConfirmationURL }}`.

Limite do plano gratuito: o e-mail embutido do Supabase manda poucos e-mails por hora.
Para o lançamento, dá para ligar um SMTP gratuito (ex.: Resend) em **Authentication → Emails → SMTP Settings**.

## 6. Variáveis do site

No `.env.local` (e depois na Vercel, em **Settings → Environment Variables**):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon / publishable>
NEXT_PUBLIC_SITE_URL=https://devsync.vercel.app
```

## 7. Aplicar o banco (migrações)

Só depois do seu ok. Com o Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

Isso cria as tabelas, as regras de acesso e o bucket de fotos de perfil.
