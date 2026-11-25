import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers/session";
import { makeZip } from "./helpers/zip";

// Precisa do Supabase local e do serviço de demos local (wrangler dev na porta 8787).
test.describe.configure({ timeout: 150_000 });

/** PNG de verdade gerado no navegador (sem arquivo binário no repo). */
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
      ctx.fillStyle = "#fff";
      ctx.font = "bold 120px sans-serif";
      ctx.fillText("Minha capa", 120, h / 2);
      return c.toDataURL("image/png");
    },
    [width, height] as const,
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

test("capa própria: escolhe e recorta ao publicar, aparece no card, e dá para remover ao editar", async ({ page }) => {
  await signUp(page, "capa", "Clara Dev");
  const title = `Capa E2E ${Date.now().toString(36)}`;
  await page.goto("/projetos/novo", { waitUntil: "networkidle" });
  await page.getByLabel("Título").fill(title);
  await page.getByRole("checkbox", { name: "react", exact: true }).check({ force: true });

  // Sem capa, a prévia explica o que o card vai mostrar.
  await expect(page.getByText("Sem capa, o card mostra um print da demo.")).toBeVisible();
  await page.getByLabel("Escolher capa").setInputFiles({ name: "capa.png", mimeType: "image/png", buffer: await makePng(page, 1600, 1000) });
  const dialog = page.getByRole("dialog", { name: "Recortar capa do projeto" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Usar imagem" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("img", { name: "Capa do projeto" })).toHaveAttribute("src", /^blob:/);
  await page.screenshot({ path: "test-results/capa-publicar.png", fullPage: true });

  await page.getByLabel("Arquivo .zip da demo").setInputFiles({ name: "site.zip", mimeType: "application/zip", buffer: makeZip({ "index.html": "<h1>Oi</h1>" }) });
  await page.getByRole("button", { name: "Publicar projeto" }).click();
  await expect(page).toHaveURL(/\?publicado=1$/, { timeout: 60_000 });
  const projectUrl = page.url().replace(/\?.*$/, "");

  // No card, a capa do Storage (16:9, 1280×720).
  await page.goto("/projetos", { waitUntil: "networkidle" });
  const cover = page.getByRole("img", { name: `Capa de ${title}` });
  await expect(cover).toHaveAttribute("src", /\/storage\/v1\/object\/public\/project-covers\/[0-9a-f-]{36}\/cover-\d+\.webp\?v=\d+$/);
  await expect.poll(() => cover.evaluate((img: HTMLImageElement) => `${img.naturalWidth}x${img.naturalHeight}`)).toBe("1280x720");
  await cover.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/capa-card.png" });

  // Editar: a capa atual aparece; remover volta ao desenho padrão.
  await page.goto(`${projectUrl}/editar`, { waitUntil: "networkidle" });
  await expect(page.getByRole("img", { name: "Capa do projeto" })).toHaveAttribute("src", /project-covers/);
  await page.screenshot({ path: "test-results/capa-editar.png", fullPage: true });
  await page.getByRole("button", { name: "Remover capa" }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(/\?editado=1$/);
  await page.goto("/projetos", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: `Capa de ${title}` })).toHaveCount(0);
});
