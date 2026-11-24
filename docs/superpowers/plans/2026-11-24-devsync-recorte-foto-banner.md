# Recorte e envio de foto e banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tela `/configuracoes`, a pessoa escolhe uma imagem, recorta (arrastar + zoom, teclado e toque) e a foto (512×512) ou banner (1500×500) em WebP só é enviada ao Storage quando ela clica em Salvar.

**Architecture:** Matemática do recorte em funções puras (`crop-math.ts`), desenho no canvas num módulo pequeno (`render-crop.ts`), um diálogo de recorte sem biblioteca (`image-cropper.tsx`) e um campo (`profile-image-field.tsx`) que guarda a imagem pendente. No submit, o formulário envia as imagens pendentes pelo cliente Supabase do navegador (`profile-images.ts`) e passa só a URL (ou `remove`) para a server action, que confere a pasta e grava a coluna.

**Tech Stack:** Next.js 16, React 19, Supabase Storage (`@supabase/ssr` cliente do navegador), Canvas 2D, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-devsync-perfil-personalizado-design.md` (seção "Fotos e banner").

## Global Constraints

- Saída: foto quadrada **512×512**, banner 3:1 **1500×500**, **WebP** gerado no navegador via canvas.
- ~~Caminhos fixos com `upsert`~~ **Mudança na revisão:** um arquivo por envio (`avatars/<id>/avatar-<ts>.webp`, `banners/<id>/banner-<ts>.webp`), URL com `?v=<ts>`. Com caminho fixo, um envio seguido de falha ao salvar trocava a imagem publicada. A ação de salvar apaga os outros arquivos da pasta depois que o perfil salva (sem órfãos).
- Só envia ao clicar em Salvar; antes disso a imagem aparece só na prévia. Sair sem salvar não muda o perfil.
- "Remover foto" / "Remover banner": apaga o arquivo e zera a coluna; sem foto aparecem as iniciais.
- Banco/servidor só aceitam em `avatar_url`/`banner_url`: nulo, o valor atual, ou `<SUPABASE_URL>/storage/v1/object/public/<bucket>/<id>/...`.
- Sem biblioteca nova. Funciona com toque. Teclado: setas movem, `+`/`-` dão zoom.
- Limites dos buckets: `avatars` 2 MB, `banners` 4 MB; tipos png/jpeg/webp.
- Textos em PT-BR em `messages/pt-BR.json` (next-intl, namespace `Settings`).
- Depende do PR da thread "Melhorar a tela de editar perfil" (migration com `banner_url`, bucket `banners`, nova `ProfileForm`). Ler `node_modules/next/dist/docs/` antes de mexer em server actions.

## Review Focus

- Navegador que não gera WebP no canvas (Safari antigo devolve PNG): `renderCrop` cai para JPEG 0,9 e o envio usa o `contentType` real; o caminho continua `*.webp` (sem órfãos).
- Imagem menor que a saída (ex.: 300×300 para foto): zoom mínimo ainda cobre todo o quadro; a imagem é ampliada, nunca sobra borda vazia.
- Arquivo que não é imagem ou imagem corrompida (`.txt` renomeado, HEIC no Chrome): o campo mostra "Não foi possível abrir essa imagem" e nada muda.
- Falha no envio durante o Salvar (rede, limite do bucket): a server action não é chamada, o erro aparece e a imagem pendente continua para tentar de novo.
- Trocar a imagem e depois cancelar o recorte, ou remover e escolher de novo antes de salvar: o estado final é o último gesto (pendente substitui remover e vice-versa); `URL.createObjectURL` antigo é revogado.

---

### Task 1: Matemática do recorte (funções puras)

**Files:**
- Create: `src/lib/images/crop-math.ts`
- Test: `src/lib/images/crop-math.test.ts`

**Interfaces:**
- Produces:
  - `export type CropView = { zoom: number; x: number; y: number }` — `zoom` ≥ 1 multiplica a escala mínima que cobre o quadro; `x`,`y` = centro visível em pixels da imagem original.
  - `export const CROP_OUTPUT = { avatar: { width: 512, height: 512 }, banner: { width: 1500, height: 500 } } as const`
  - `export type CropKind = keyof typeof CROP_OUTPUT`
  - `export const ZOOM_MAX = 4`
  - `initialView(img: Size): CropView` → `{ zoom: 1, x: img.width/2, y: img.height/2 }`
  - `coverScale(img: Size, frame: Size): number` — `max(frame.w/img.w, frame.h/img.h)`
  - `clampView(view: CropView, img: Size, frame: Size): CropView` — zoom em `[1, ZOOM_MAX]`, centro preso para o quadro nunca sair da imagem.
  - `panBy(view, dxScreen, dyScreen, img, frame): CropView` — arrastar na tela em px do quadro (divide por `coverScale*zoom`, sinal invertido: arrastar para a direita mostra mais à esquerda), já com `clampView`.
  - `zoomTo(view, zoom, img, frame): CropView` — mantém o centro, `clampView`.
  - `sourceRect(view, img, frame): { sx: number; sy: number; sw: number; sh: number }` — retângulo da imagem original que vai para a saída.
  - `type Size = { width: number; height: number }` (exportado).

- [ ] **Step 1: Write the failing tests**

```ts
const img = { width: 2000, height: 1000 };
const square = { width: 512, height: 512 };
test("coverScale cobre o quadro", () => expect(coverScale(img, square)).toBeCloseTo(0.512));
test("sourceRect inicial pega o centro quadrado", () =>
  expect(sourceRect(initialView(img), img, square)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 }));
test("zoom 2 pega metade", () =>
  expect(sourceRect(zoomTo(initialView(img), 2, img, square), img, square)).toEqual({ sx: 750, sy: 250, sw: 500, sh: 500 }));
test("panBy não deixa sair da imagem", () =>
  expect(sourceRect(panBy(initialView(img), 99999, 0, img, square), img, square).sx).toBe(0));
test("zoom fica entre 1 e ZOOM_MAX", () => {
  expect(zoomTo(initialView(img), 0.2, img, square).zoom).toBe(1);
  expect(zoomTo(initialView(img), 10, img, square).zoom).toBe(ZOOM_MAX);
});
test("imagem menor que a saída ainda cobre o quadro", () => {
  const small = { width: 300, height: 300 };
  expect(sourceRect(initialView(small), small, square)).toEqual({ sx: 0, sy: 0, sw: 300, sh: 300 });
});
test("banner 3:1 numa imagem quadrada", () =>
  expect(sourceRect(initialView({ width: 900, height: 900 }), { width: 900, height: 900 }, CROP_OUTPUT.banner))
    .toEqual({ sx: 0, sy: 300, sw: 900, sh: 300 }));
```

- [ ] **Step 2:** `npx vitest run src/lib/images/crop-math.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar as funções acima (valores arredondados com `Math.round` só em `sourceRect`).
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** `git commit -m "feat(perfil): matemática do recorte de imagem"`

### Task 2: Desenhar o recorte em WebP

**Files:**
- Create: `src/lib/images/render-crop.ts`
- Test: `src/lib/images/render-crop.test.ts`

**Interfaces:**
- Consumes: `CropView`, `CropKind`, `CROP_OUTPUT`, `sourceRect`, `Size` (Task 1).
- Produces:
  - `loadImage(file: Blob): Promise<HTMLImageElement>` — via `URL.createObjectURL` + `img.decode()`; revoga a URL; rejeita com `Error("invalid-image")`.
  - `renderCrop(img: HTMLImageElement, view: CropView, kind: CropKind, canvas?: HTMLCanvasElement): Promise<Blob>` — canvas no tamanho de `CROP_OUTPUT[kind]`, `imageSmoothingQuality = "high"`, `drawImage` com `sourceRect`, `toBlob("image/webp", 0.85)`; se o blob vier com outro tipo, refaz com `toBlob("image/jpeg", 0.9)`.

- [ ] **Step 1: Write the failing tests** (canvas falso injetado, jsdom não tem canvas):

```ts
test("desenha no tamanho da foto e pede WebP", async () => {
  const { canvas, ctx, calls } = fakeCanvas({ webp: true });
  const blob = await renderCrop(fakeImg(2000, 1000), initialView({ width: 2000, height: 1000 }), "avatar", canvas);
  expect([canvas.width, canvas.height]).toEqual([512, 512]);
  expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 500, 0, 1000, 1000, 0, 0, 512, 512);
  expect(blob.type).toBe("image/webp");
  expect(calls).toEqual([["image/webp", 0.85]]);
});
test("sem WebP no navegador cai para JPEG", async () => {
  const { canvas, calls } = fakeCanvas({ webp: false });
  const blob = await renderCrop(fakeImg(900, 900), initialView({ width: 900, height: 900 }), "banner", canvas);
  expect([canvas.width, canvas.height]).toEqual([1500, 500]);
  expect(blob.type).toBe("image/jpeg");
  expect(calls.map((c) => c[0])).toEqual(["image/webp", "image/jpeg"]);
});
```

- [ ] **Step 2:** `npx vitest run src/lib/images/render-crop.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `loadImage` e `renderCrop`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** `git commit -m "feat(perfil): gera WebP do recorte no navegador"`

### Task 3: Diálogo de recorte acessível

**Files:**
- Create: `src/components/ui/image-cropper.tsx`
- Test: `src/components/ui/image-cropper.test.tsx`
- Modify: `messages/pt-BR.json` (chaves em `Settings.cropper`: `titleAvatar` "Recortar foto", `titleBanner` "Recortar banner", `hint` "Arraste para posicionar. Setas movem, + e − aproximam.", `zoom` "Zoom", `cancel` "Cancelar", `confirm` "Usar imagem", `area` "Área de recorte")

**Interfaces:**
- Consumes: Task 1 (`initialView`, `panBy`, `zoomTo`, `coverScale`, `ZOOM_MAX`, `CROP_OUTPUT`), Task 2 (`renderCrop`).
- Produces: `ImageCropper({ image, kind, onCancel, onConfirm }: { image: HTMLImageElement; kind: CropKind; onCancel(): void; onConfirm(blob: Blob): void })`.

Comportamento: `<dialog>` aberto com `showModal()` (foco preso, `Esc` = cancelar). Quadro com `aspect-ratio` da saída (largura do quadro medida com `ResizeObserver`, ou `getBoundingClientRect` no início), a imagem dentro como `<img>` com `transform` calculado do `CropView`; máscara redonda só para `avatar` (visual; a saída é quadrada). Área de recorte é `role="application"` não; usar `tabIndex=0`, `aria-label={t("area")}`, `aria-describedby` no `hint`. Arrastar com Pointer Events + `setPointerCapture` (mouse e toque); roda do mouse dá zoom; `<input type="range" min=1 max=ZOOM_MAX step=0.01>` com label "Zoom". Teclado na área: setas = `panBy` 10 px (Shift = 50), `+`/`=` = zoom ×1,1, `-` = zoom ÷1,1.

- [ ] **Step 1: Write the failing tests** (mock de `renderCrop` com `vi.mock("@/lib/images/render-crop")`; `HTMLDialogElement.prototype.showModal` stub no setup do teste):

```tsx
test("setas e +/- mudam a vista que vai para o renderCrop", async () => {
  render(<ImageCropper image={fakeImg(2000, 1000)} kind="avatar" onCancel={vi.fn()} onConfirm={onConfirm} />);
  const area = screen.getByLabelText("Área de recorte");
  await user.type(area, "+");
  await user.click(screen.getByRole("button", { name: "Usar imagem" }));
  expect(renderCrop).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ zoom: 1.1 }), "avatar");
  expect(onConfirm).toHaveBeenCalledWith(blob);
});
test("slider de zoom tem rótulo e limites", () => { /* getByLabelText("Zoom") com min "1" e max "4" */ });
test("Cancelar chama onCancel sem gerar imagem", async () => { /* renderCrop não chamado */ });
test("ArrowLeft move a vista para a esquerda", async () => { /* x final < 1000 com zoom 2 */ });
```

- [ ] **Step 2:** `npx vitest run src/components/ui/image-cropper.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar o componente.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** `git commit -m "feat(perfil): diálogo de recorte com arrastar, zoom e teclado"`

### Task 4: Envio e remoção no Storage + validação da URL

**Files:**
- Create: `src/lib/social/profile-images.ts` (cliente, sem `server-only`)
- Create: `src/lib/social/profile-image-url.ts` (puro, usado pelo servidor)
- Test: `src/lib/social/profile-images.test.ts`, `src/lib/social/profile-image-url.test.ts`

**Interfaces:**
- Consumes: `CropKind` (Task 1).
- Produces:
  - `export const IMAGE_BUCKET = { avatar: "avatars", banner: "banners" } as const`
  - `imagePath(userId: string, kind: CropKind): string` → `"<id>/avatar.webp"` / `"<id>/banner.webp"`
  - `uploadProfileImage(supabase: SupabaseClient, userId: string, kind: CropKind, blob: Blob, now = Date.now()): Promise<string>` — `storage.from(bucket).upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "3600" })`; devolve `getPublicUrl(path).data.publicUrl + "?v=" + now`; lança `Error("upload-failed")` se `error`.
  - `isOwnStorageUrl(url: string, supabaseUrl: string, kind: CropKind, userId: string): boolean` — `true` só se começa com `${supabaseUrl}/storage/v1/object/public/${bucket}/${userId}/` (sem `..`, sem `//` depois do prefixo).
  - `removeProfileImage(supabase, userId, kind): Promise<void>` — `storage.from(bucket).remove([path])`; erro de "não existe" ignorado.

- [ ] **Step 1: Write the failing tests**

```ts
test("upload usa caminho fixo, upsert e devolve URL com ?v=", async () => {
  const { client, upload } = fakeSupabase("https://x.supabase.co");
  const url = await uploadProfileImage(client, "u1", "banner", new Blob(["a"], { type: "image/webp" }), 42);
  expect(upload).toHaveBeenCalledWith("u1/banner.webp", expect.any(Blob), expect.objectContaining({ upsert: true, contentType: "image/webp" }));
  expect(url).toBe("https://x.supabase.co/storage/v1/object/public/banners/u1/banner.webp?v=42");
});
test("JPEG de fallback vai com o contentType real", /* contentType: "image/jpeg", mesmo caminho */);
test("erro no upload lança upload-failed", /* rejects.toThrow("upload-failed") */);
test.each([
  ["https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar.webp?v=1", true],
  ["https://x.supabase.co/storage/v1/object/public/avatars/u2/avatar.webp", false],
  ["https://x.supabase.co/storage/v1/object/public/banners/u1/banner.webp", false], // bucket errado p/ avatar
  ["https://x.supabase.co/storage/v1/object/public/avatars/u1/../u2/a.webp", false],
  ["https://evil.com/storage/v1/object/public/avatars/u1/a.webp", false],
])("isOwnStorageUrl(%s) = %s", (url, ok) => expect(isOwnStorageUrl(url, "https://x.supabase.co", "avatar", "u1")).toBe(ok));
```

- [ ] **Step 2:** `npx vitest run src/lib/social/profile-image` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** `git commit -m "feat(perfil): envio da foto e do banner ao Storage"`

### Task 5: Campo de imagem pendente e ligação com o Salvar

**Files:**
- Create: `src/components/social/profile-image-field.tsx`, test `src/components/social/profile-image-field.test.tsx`
- Modify: a `ProfileForm` nova da parte 1 (`src/components/social/profile-form.tsx` ou onde o PR base deixar), `messages/pt-BR.json` (`Settings.image`: `change` "Trocar foto"/"Trocar banner", `remove` "Remover foto"/"Remover banner", `invalid` "Não foi possível abrir essa imagem", `tooBig` "Imagem grande demais", `uploadFailed` "Não foi possível enviar a imagem. Tente de novo.", `pending` "Aparece no perfil depois de salvar")

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `export type PendingImage = { kind: "keep" } | { kind: "remove" } | { kind: "new"; blob: Blob; previewUrl: string }`
  - `ProfileImageField({ kind, currentUrl, value, onChange }: { kind: CropKind; currentUrl: string | null; value: PendingImage; onChange(v: PendingImage): void })` — botão "Trocar…" abre `<input type=file accept="image/png,image/jpeg,image/webp">` escondido; `loadImage` → `ImageCropper` → `onChange({ kind: "new", … })`; "Remover…" só se há imagem atual ou pendente; revoga `previewUrl` antigo. Arquivo original acima de 15 MB recusado antes de abrir (`tooBig`).
  - `previewSrc(current: string | null, p: PendingImage): string | null` (exportado, alimenta a prévia ao vivo da parte 1).
  - `preparePendingImages(supabase, userId, { avatar, banner }: Record<CropKind, PendingImage>): Promise<{ avatarUrl?: string; bannerUrl?: string }>` — contrato da parte 1: campo ausente = não mexe, `""` = remover, URL = a do upload.
- A server action `saveProfile` é da parte 1 (thread da base): ela já lê `avatarUrl`/`bannerUrl`, confere a pasta e, quando vier `""`, grava `null` e chama `removeProfileImage` (Task 4) **depois** do `update` dar certo. Aqui só confirmar que isso está na main e cobrir com teste se faltar.
- Formulário: `onSubmit` faz `preventDefault`, chama `preparePendingImages`, põe os valores presentes em `<input type=hidden name="avatarUrl|bannerUrl">`, e chama a action com `startTransition(() => action(formData))`. Se `preparePendingImages` lançar, mostra `uploadFailed` e não chama a action. O aviso de "mudanças não salvas" da parte 1 conta imagem pendente como mudança.

- [ ] **Step 1: Write the failing tests**
  - `profile-image-field.test.tsx`: escolher arquivo → (mock `loadImage`, mock `ImageCropper` que confirma) → `onChange` recebe `kind: "new"`; arquivo inválido (`loadImage` rejeita) → mostra "Não foi possível abrir essa imagem" e `onChange` não é chamado; "Remover foto" → `onChange({ kind: "remove" })`; `previewSrc(url, {kind:"remove"})` é `null`, `previewSrc(url, {kind:"keep"})` é `url`.
  - `preparePendingImages`: `keep` → campo ausente; `remove` → `""`; `new` → URL de `uploadProfileImage`.
  - `actions.test.ts`: só se a parte 1 não cobrir `avatarUrl` de outro id recusado e `bannerUrl=""` removendo o arquivo.
  - Formulário: `uploadProfileImage` rejeita → mensagem `uploadFailed` visível e `saveProfile` não chamado.
- [ ] **Step 2:** `npx vitest run src/components/social src/app/\(app\)/configuracoes` → FAIL nos testes novos.
- [ ] **Step 3:** Implementar campo, `preparePendingImages`, ligação no formulário e na action.
- [ ] **Step 4:** → PASS; depois `npm run typecheck && npm run lint && npm test`.
- [ ] **Step 5:** `git commit -m "feat(perfil): trocar e remover foto e banner ao salvar"`

### Task 6: Fluxo de ponta a ponta e verificação

**Files:**
- Create: `e2e/perfil-imagens.spec.ts`, fixture `e2e/fixtures/foto.png` (gerada com canvas no próprio teste se não houver fixture binária no repo)

- [ ] **Step 1:** Teste Playwright (segue o padrão de login dos specs existentes; pula se o ambiente de e2e não tiver Supabase, como os outros): abre `/configuracoes`, escolhe `foto.png`, aperta `+` duas vezes e `ArrowRight` na área, "Usar imagem", confere a prévia com `blob:`; recarrega sem salvar → foto antiga; repete e clica Salvar → perfil mostra `avatar.webp?v=`.
- [ ] **Step 2:** `npx playwright test e2e/perfil-imagens.spec.ts --trace off` → PASS (ou SKIP justificado).
- [ ] **Step 3:** Conferir manualmente com o skill `run`: recorte com toque emulado (dispositivo "Pixel 7") e no desktop; screenshot da tela para o PR.
- [ ] **Step 4:** `git commit -m "test(perfil): fluxo de recorte e envio da foto"`
