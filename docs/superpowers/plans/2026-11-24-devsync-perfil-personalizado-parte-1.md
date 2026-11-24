# Perfil personalizado, parte 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perfil personalizável (banner, foto, borda, cargo, localização, status, mais links, cor de destaque) e nova tela de editar perfil.

**Architecture:** Colunas novas em `profiles` com checagens e gatilho de URL no Postgres; catálogo único de chaves em `src/lib/social/profile-style.ts`; ação de servidor `saveProfile` amplia o que grava; imagens recortadas no navegador e enviadas ao Storage só ao salvar.

**Tech Stack:** Next.js 16, Supabase (Postgres + Storage), Tailwind 4, next-intl, Vitest, pgTAP, Playwright.

**Spec:** docs/superpowers/specs/2026-11-24-devsync-perfil-personalizado-design.md

## Global Constraints

- Migration: `supabase/migrations/20261124500000_profile_customization.sql`. A parte 2 (insígnias) usa timestamp maior.
- Limites: headline ≤ 80, location ≤ 60. Status: `open_to_work|building|learning|mentoring|freelance`. Banner preset: `aurora|circuito|grade|ondas|noite|hex`. Accent: `azul|ciano|violeta|verde|ambar|rosa`. avatar_frame: formato `^[a-z0-9_]{1,30}$` (bordas livres `azul|ciano|gradiente|neutra`; bloqueadas vêm na parte 2).
- Links: github (usuário), linkedin (usuário `[A-Za-z0-9-_%]{3,100}`), x (usuário `[A-Za-z0-9_]{1,15}`), youtube (handle `@?[A-Za-z0-9._-]{3,30}`), site (https).
- Bucket `banners`: público, 4 MB (4194304), png/jpeg/webp. Caminhos fixos `<bucket>/<id>/avatar.webp`, `banners/<id>/banner.webp`.
- `avatar_url`/`banner_url` só aceitam nulo, valor inalterado ou `https?://<host>/storage/v1/object/public/<bucket>/<id>/<arquivo>[?v=<dígitos>]`.
- Remoto sem grants automáticos: grant explícito + arquivo `/mnt/project-files/supabase/aplicar-perfil-personalizado.sql`.
- Textos em PT-BR em `messages/pt-BR.json`.

## Review Focus

- Pessoa com foto do GitHub salva o perfil sem mexer na foto: tem que passar (valor inalterado).
- Perfil antigo sem as colunas novas preenchidas: página e formulário funcionam com nulos.
- Link colado como URL completa (`https://linkedin.com/in/ana/`, `x.com/ana`, `youtube.com/@ana`): normaliza para o usuário.
- Salvar falha depois do envio da imagem: o perfil continua consistente (URL só gravada se o envio deu certo).
- Celular estreito (360 px): barra de salvar fixa não cobre o último campo.

---

### Task 1: Banco (colunas, checagens, guarda de URL, bucket de banners)

**Files:** Create `supabase/migrations/20261124500000_profile_customization.sql`, `supabase/tests/database/13_profile_customization.test.sql`; update `private.apply_api_grants()` grant list of profiles (in the new migration, redefine the function with the larger column list).

- [ ] Teste pgTAP: colunas existem; headline 81 chars falha 23514; status inválido falha; preset/accent inválidos falham; avatar_frame `Ab!` falha; usuário atualiza headline/location/status/banner_preset/avatar_frame/accent/banner_url; avatar_url externo novo falha (P0001 / mensagem); avatar_url da própria pasta passa; da pasta de outro falha; avatar_url inalterado (GitHub) passa ao mudar bio; bucket banners existe (pulado sem storage).
- [ ] Rodar `scripts/test-db.sh supabase/tests/database/13_profile_customization.test.sql` → falha.
- [ ] Migration; gatilho `profiles_image_urls_guard` (before update) com função `private.check_profile_image_url(url text, bucket text, owner uuid) returns boolean`.
- [ ] Rodar todos os testes do banco → PASS. Gerar o arquivo remoto. Commit.

### Task 2: Catálogo e regras

**Files:** Create `src/lib/social/profile-style.ts` (+ test); modify `src/lib/social/profile-rules.ts` (+ test), `src/lib/social/queries.ts` (`ProfileData`, `toLinks`, `getProfile`), `src/app/(app)/configuracoes/actions.ts` (+ test).

**Produces:**
- `STATUSES`, `BANNER_PRESETS`, `ACCENTS`, `FREE_FRAMES` (readonly tuples) e tipos `ProfileStatus`, `BannerPreset`, `Accent`, `AvatarFrame = string`; `isStatus/isBannerPreset/isAccent/isFrameKey(v: string): boolean`; `ACCENT_COLORS: Record<Accent, string>` (hex).
- `ProfileInput` ganha `headline, location, status, bannerPreset, avatarFrame, accent, linkedin, x, youtube` (strings, "" = nulo).
- `ProfileLinks` ganha `linkedin?, x?, youtube?`; `ProfileData` ganha `headline, location, status, bannerUrl, bannerPreset, avatarFrame, accent` (string | null).
- `saveProfile` grava as colunas novas; aceita `avatarUrl`/`bannerUrl` do form (string vazia = remover; ausente = não mexe).

- [ ] Testes Vitest para normalização de links e chaves inválidas; rodar → falha; implementar; passar; commit.

### Task 3: PR da base → mesclar (libera threads de recorte e de página do perfil)

### Task 4: Nova tela de editar perfil

**Files:** `src/app/(app)/configuracoes/page.tsx`, `src/components/social/profile-form.tsx` dividido em `src/components/social/profile-editor/*` (seções + prévia), mensagens.

- [ ] Teste de componente: seções Aparência, Sobre você, Links, Tecnologias com títulos; prévia muda ao digitar cargo; status escolhido aparece na prévia; aviso de mudanças não salvas (`beforeunload`).
- [ ] E2E em `e2e/social.spec.ts`: editar cargo + status + LinkedIn e ver no perfil.
- [ ] Implementar layout: desktop 2 colunas (form + prévia fixa), celular prévia compacta e barra Salvar fixa com `pb` de compensação.
- [ ] lint, typecheck, test, build → PASS; PR; revisão; merge.
