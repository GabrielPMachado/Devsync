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
