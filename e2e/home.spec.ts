import { expect, test } from "@playwright/test";

test("página inicial abre em pt-BR com o tema escuro da Devsync", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);

  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page).toHaveTitle("Devsync");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Mais do que compartilhar código, conectar pessoas.",
  );
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(7, 11, 20)");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("color", "rgb(248, 250, 252)");
});

test("visitante vê a barra de navegação e o botão Entrar", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav.getByRole("link")).toHaveText(["Início", "Projetos", "Estudos"]);
  await expect(nav.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Entrar na Devsync" })).toBeVisible();
});
