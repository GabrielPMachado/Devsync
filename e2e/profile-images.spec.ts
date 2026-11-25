import { expect, test, type Page } from "@playwright/test";
import { newMember } from "./helpers/session";

/** Gera um PNG de verdade no próprio navegador (sem arquivo binário no repo). */
async function makePng(page: Page, width: number, height: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#1d4ed8");
      g.addColorStop(1, "#06b6d4");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      return c.toDataURL("image/png");
    },
    [width, height] as const,
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

test("trocar a foto: recorta, só vale depois de salvar, e remover volta às iniciais", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, username } = await newMember(browser, "Iris");
  await page.goto("/configuracoes", { waitUntil: "networkidle" });
  const preview = page.getByRole("region", { name: "Prévia do perfil" });
  const png = await makePng(page, 1200, 800);

  // Escolhe, recorta pelo teclado e confirma: aparece só na prévia.
  await page.getByLabel("Trocar foto").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  const dialog = page.getByRole("dialog", { name: "Recortar foto" });
  await expect(dialog).toBeVisible();
  const area = dialog.getByLabel("Área de recorte");
  await area.focus();
  await area.press("+");
  await area.press("+");
  await area.press("ArrowRight");
  await dialog.getByRole("button", { name: "Usar imagem" }).click();
  await expect(dialog).toBeHidden();
  await expect(preview.locator('img[src^="blob:"]')).toBeVisible();
  await expect(page.getByText("Aparece no perfil depois de salvar.")).toBeVisible();

  // Sair sem salvar não muda o perfil.
  page.once("dialog", (d) => d.accept());
  await page.reload({ waitUntil: "networkidle" });
  await expect(preview.getByRole("img", { name: "Iris" })).toHaveCount(0);

  // De novo, agora salvando: a foto vai para o Storage, na pasta da pessoa.
  await page.getByLabel("Trocar foto").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await dialog.getByRole("button", { name: "Usar imagem" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(new RegExp(`/@${username}\\?salvo=1$`));
  const photo = page.locator('img[src*="/storage/v1/object/public/avatars/"]').first();
  await expect(photo).toHaveAttribute("src", /\/avatar-\d+\.webp\?v=\d+$/);
  // A imagem existe de verdade e tem 512×512.
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => `${img.naturalWidth}x${img.naturalHeight}`)).toBe("512x512");

  // Remover foto: some do perfil.
  await page.goto("/configuracoes", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Remover foto" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(new RegExp(`/@${username}\\?salvo=1$`));
  // Só o que aparece na tela: o Next guarda escondida a tela de edição que acabou de sair.
  await expect(page.locator('img[src*="/avatars/"]:visible')).toHaveCount(0);
});

test("banner enviado sai em 1500×500", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, username } = await newMember(browser, "Joel");
  await page.goto("/configuracoes", { waitUntil: "networkidle" });
  await page.getByLabel("Trocar banner").setInputFiles({ name: "capa.png", mimeType: "image/png", buffer: await makePng(page, 900, 900) });
  const dialog = page.getByRole("dialog", { name: "Recortar banner" });
  await dialog.getByRole("button", { name: "Usar imagem" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(new RegExp(`/@${username}\\?salvo=1$`));

  await page.goto("/configuracoes", { waitUntil: "networkidle" });
  const html = await page.getByRole("region", { name: "Prévia do perfil" }).innerHTML();
  const url = html.match(/https?:[^"')&]+\/banners\/[^"')&]+banner-\d+\.webp\?v=\d+/)?.[0];
  expect(url).toBeTruthy();
  const size = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return `${img.naturalWidth}x${img.naturalHeight}`;
  }, url!);
  expect(size).toBe("1500x500");
});
