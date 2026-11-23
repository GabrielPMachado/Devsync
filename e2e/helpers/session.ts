import { expect, type Page } from "@playwright/test";
import { latestLinkFor, uniqueEmail } from "./mailpit";

/** Cria uma conta nova pelo link mágico e escolhe o @usuário. Devolve o @. */
export async function signUp(page: Page, prefix: string, displayName: string): Promise<string> {
  const email = uniqueEmail(prefix);
  const username = `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`;
  await page.goto("/entrar", { waitUntil: "networkidle" });
  const since = new Date();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  await page.goto(await latestLinkFor(email, since));
  await expect(page).toHaveURL(/\/boas-vindas$/);
  await page.getByLabel("Nome").fill(displayName);
  await page.getByLabel("@usuário").fill(username);
  await expect(page.getByText(`@${username} está disponível`)).toBeVisible();
  for (const tag of ["react", "typescript", "css"]) await page.getByText(tag, { exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/$/);
  return username;
}
