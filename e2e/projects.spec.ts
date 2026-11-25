import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers/session";
import { makeZip } from "./helpers/zip";

// Precisa do Supabase local e do serviço de demos local (wrangler dev na porta 8787).
test.describe.configure({ mode: "serial", timeout: 120_000 });

async function publishWithZip(page: Page, title: string, files: Record<string, string>) {
  await page.getByRole("link", { name: "Publicar", exact: true }).click();
  await expect(page).toHaveURL(/\/projetos\/novo$/);
  await expect(page.getByRole("heading", { name: "Publicar projeto" })).toBeVisible();
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Descrição").fill("Quadro para a turma.\n\n## Como foi feito\n\n- HTML puro");
  await page.getByRole("checkbox", { name: "react", exact: true }).check({ force: true });
  await page.getByRole("checkbox", { name: "css", exact: true }).check({ force: true });
  await page.getByLabel("Arquivo .zip da demo").setInputFiles({ name: "site.zip", mimeType: "application/zip", buffer: makeZip(files) });
  await page.getByRole("button", { name: "Publicar projeto" }).click();
}

test("publicar com zip e abrir a demo na camada", async ({ page }) => {
  await signUp(page, "pub", "Paula Dev");
  const title = `Kanban E2E ${Date.now().toString(36)}`;
  await publishWithZip(page, title, { "index.html": "<!doctype html><title>Demo</title><h1>Demo E2E</h1>" });

  await expect(page).toHaveURL(/\/projetos\/kanban-e2e-[a-z0-9-]+\?publicado=1$/, { timeout: 60_000 });
  await expect(page.getByText("Projeto publicado! A demo já está no ar.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("Demo ao vivo").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como foi feito" })).toBeVisible();

  await page.getByRole("link", { name: "Abrir demo" }).last().click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/[?&]demo=[0-9a-f-]{36}/);
  await expect(dialog.frameLocator("iframe").getByRole("heading", { name: "Demo E2E" })).toBeVisible();
  // Nunca abre outra guia.
  await expect(page.locator('[target="_blank"]')).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/demo=/);

  // Pela lista de projetos também abre por cima.
  await page.goto("/projetos");
  await page.getByRole("link", { name: `Ver demo de ${title}` }).click();
  await expect(page.getByRole("dialog", { name: title }).frameLocator("iframe").getByRole("heading", { name: "Demo E2E" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar demo" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/projetos$/);
});

test("zip sem index.html é recusado e não vira projeto", async ({ page }) => {
  await signUp(page, "rec", "Rita Dev");
  const title = `Sem index ${Date.now().toString(36)}`;
  await publishWithZip(page, title, { "pagina.html": "<h1>oi</h1>", "outra/coisa.html": "<p>x</p>" });
  await expect(page.getByText("Não achamos o index.html na raiz do .zip (nem numa única pasta).")).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/projetos\/novo$/);
  await page.goto("/projetos");
  await expect(page.getByRole("heading", { name: "Projetos", level: 1 })).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("curtir, comentar e responder", async ({ page, browser }) => {
  await signUp(page, "aut", "Autor Dev");
  const title = `Curtidas E2E ${Date.now().toString(36)}`;
  await publishWithZip(page, title, { "index.html": "<h1>Oi</h1>" });
  await expect(page).toHaveURL(/\?publicado=1$/, { timeout: 60_000 });
  const projectUrl = page.url().replace(/\?.*$/, "");

  // Visitante vê o convite para entrar.
  const visitor = await browser.newPage();
  await visitor.goto(projectUrl);
  await expect(visitor.getByRole("link", { name: "Entre para comentar" })).toBeVisible();
  await visitor.close();

  await page.getByRole("button", { name: "Curtir" }).click();
  await expect(page.getByRole("button", { name: "Descurtir" })).toContainText("1");
  // Espera a ação terminar (o botão fica desativado enquanto ela roda).
  await expect(page.getByRole("button", { name: "Descurtir" })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Descurtir" })).toContainText("1");

  await page.getByLabel("Escreva um comentário").fill("Ficou muito bom!");
  await page.getByRole("button", { name: "Comentar" }).click();
  await expect(page.getByText("Ficou muito bom!")).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 comentário" })).toBeVisible();

  await page.getByRole("button", { name: "Responder" }).click();
  await page.getByLabel("Responder a Autor Dev").fill("Valeu!");
  await page.getByRole("button", { name: "Enviar resposta" }).click();
  await expect(page.getByText("Valeu!")).toBeVisible();
  await expect(page.getByRole("heading", { name: "2 comentários" })).toBeVisible();

  // Da camada de demo, o botão de comentários leva à página do projeto, sem reabrir a camada.
  await page.getByRole("link", { name: "Abrir demo" }).last().click();
  await page.getByRole("dialog").getByRole("link", { name: "Comentários do projeto" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/projetos\/[a-z0-9-]+#comentarios$/);
});

test("dono edita e exclui o projeto (com confirmação)", async ({ page, browser }) => {
  await signUp(page, "edt", "Edu Dev");
  const title = `Editar E2E ${Date.now().toString(36)}`;
  await publishWithZip(page, title, { "index.html": "<h1>Oi</h1>" });
  await expect(page).toHaveURL(/\?publicado=1$/, { timeout: 60_000 });
  const projectUrl = page.url().replace(/\?.*$/, "");

  // Outra pessoa não vê Editar/Excluir e não abre a tela de editar.
  const other = await browser.newPage();
  await other.goto(projectUrl);
  await expect(other.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(other.getByRole("link", { name: "Editar projeto" })).toHaveCount(0);
  await expect(other.getByRole("button", { name: "Excluir projeto" })).toHaveCount(0);
  await other.close();

  await page.getByRole("link", { name: "Editar projeto" }).click();
  await expect(page).toHaveURL(/\/editar$/);
  await expect(page.getByRole("textbox", { name: "Título" })).toHaveValue(title);
  await page.getByRole("textbox", { name: "Título" }).fill(`${title} v2`);
  await page.getByRole("checkbox", { name: "css", exact: true }).uncheck({ force: true });
  await page.getByRole("checkbox", { name: "typescript", exact: true }).check({ force: true });
  await page.getByRole("textbox", { name: "Site do projeto" }).fill("https://exemplo.dev");
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page).toHaveURL(`${projectUrl}?editado=1`);
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: `${title} v2` })).toBeVisible();
  await expect(page.getByText("typescript", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "exemplo.dev" })).toBeVisible();

  // No celular os botões continuam à mão.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Excluir projeto" }).click();
  const confirm = page.getByRole("dialog", { name: `Excluir “${title} v2”?` });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toBeHidden();

  await page.getByRole("button", { name: "Excluir projeto" }).click();
  await page.getByRole("button", { name: "Excluir de vez" }).click();
  await expect(page).toHaveURL(/\/projetos\?excluido=1$/);
  await expect(page.getByText("Projeto excluído.")).toBeVisible();
  await expect(page.getByRole("link", { name: `Ver demo de ${title} v2` })).toHaveCount(0);

  await page.goto(projectUrl);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});
