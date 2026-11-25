import { expect, test } from "@playwright/test";
import { adminEnv, makeAdmin } from "./helpers/admin";
import { newMember } from "./helpers/session";

test("moderação dá insígnia, edita perfil e desliga item do catálogo", async ({ browser }) => {
  test.skip(!adminEnv(), "Precisa de E2E_SUPABASE_URL e E2E_SUPABASE_SERVICE_ROLE_KEY (Supabase local)");
  test.setTimeout(120_000);

  const lia = await newMember(browser, "Lia");
  const mod = await newMember(browser, "Chefe");
  await makeAdmin(mod.username);

  // Acha a Lia na aba Perfis e abre a página dela.
  await mod.page.goto(`/admin?aba=perfis&q=${lia.username}`, { waitUntil: "networkidle" });
  await mod.page.getByRole("listitem").filter({ hasText: `@${lia.username}` }).getByRole("link", { name: "Gerenciar" }).click();
  await expect(mod.page.getByRole("heading", { level: 1, name: "Lia" })).toBeVisible();

  // Dá a insígnia Mentor e libera a borda Prisma (de Influente).
  await mod.page.getByRole("button", { name: "Dar: Mentor" }).click();
  await expect(mod.page.getByRole("button", { name: "Tirar: Mentor" })).toBeVisible();
  await mod.page.getByRole("button", { name: "Liberar: Prisma" }).click();
  await expect(mod.page.getByRole("button", { name: "Tirar: Prisma" })).toBeVisible();

  // Corrige o nome; tudo vai para o histórico.
  await mod.page.getByLabel("Nome", { exact: true }).fill("Lia Souza");
  await mod.page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(mod.page.getByRole("heading", { level: 1, name: "Lia Souza" })).toBeVisible();
  const history = mod.page.getByRole("list").filter({ hasText: "Deu a insígnia Mentor" });
  await expect(history.getByText("Editou: nome")).toBeVisible();
  await expect(history.getByText("Liberou borda Prisma")).toBeVisible();

  // Desliga o banner Nebulosa no catálogo.
  await mod.page.goto("/admin?aba=catalogo", { waitUntil: "networkidle" });
  await mod.page.getByRole("button", { name: "Desligar: Nebulosa" }).click();
  await expect(mod.page.getByRole("button", { name: "Ligar: Nebulosa" })).toBeVisible();

  // No editor da Lia: banner desligado sumiu, borda Prisma e Néon (da insígnia) liberadas.
  await lia.page.goto("/configuracoes", { waitUntil: "networkidle" });
  await expect(lia.page.getByRole("radio", { name: "Aurora" })).toBeVisible();
  await expect(lia.page.getByRole("radio", { name: "Nebulosa" })).toHaveCount(0);
  await expect(lia.page.getByRole("radio", { name: "Borda prisma" })).toBeVisible();
  await expect(lia.page.getByRole("radio", { name: "Borda néon" })).toBeVisible();

  // Volta o catálogo como estava (o banco local é compartilhado entre testes).
  await mod.page.getByRole("button", { name: "Ligar: Nebulosa" }).click();
  await expect(mod.page.getByRole("button", { name: "Desligar: Nebulosa" })).toBeVisible();
});
