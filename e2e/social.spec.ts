import { expect, test } from "@playwright/test";
import { newMember } from "./helpers/session";

test("seguir alguém, ver o que a pessoa publica no início e receber a notificação na hora", async ({ browser }) => {
  test.setTimeout(150_000);
  const token = `zq${Date.now().toString(36)}`;
  const title = `Como organizar pastas num projeto ${token}?`;

  // Ana pergunta com uma tag que o Bruno não acompanha.
  const ana = await newMember(browser, "Ana");
  await ana.page.goto("/estudos/perguntar", { waitUntil: "networkidle" });
  await ana.page.getByLabel("Título").fill(title);
  await ana.page.getByLabel("Detalhes").fill("Quero separar componentes, páginas e regras sem bagunça.");
  await ana.page.getByLabel("Tags").fill("iniciante");
  await ana.page.getByRole("button", { name: "Publicar pergunta" }).click();
  await expect(ana.page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await ana.page.waitForLoadState("networkidle");
  const bell = ana.page.getByRole("banner").getByRole("link", { name: /^Notificações/ });
  await expect(bell).toHaveAccessibleName("Notificações");

  // Bruno ainda não segue a Ana: a pergunta não está no início dele.
  const bruno = await newMember(browser, "Bruno");
  await bruno.page.goto("/", { waitUntil: "networkidle" });
  await expect(bruno.page.getByRole("region", { name: "Seu início" }).getByRole("link", { name: title })).toHaveCount(0);

  // Bruno segue a Ana pelo perfil.
  await bruno.page.goto(`/@${ana.username}`, { waitUntil: "networkidle" });
  await expect(bruno.page.getByRole("heading", { level: 1, name: "Ana" })).toBeVisible();
  await bruno.page.getByRole("button", { name: `Seguir @${ana.username}` }).click();
  await expect(bruno.page.getByRole("button", { name: `Deixar de seguir @${ana.username}` })).toHaveText("Seguindo");
  await expect(bruno.page.getByRole("link", { name: /1\s*seguidor/ })).toBeVisible();

  // Ana recebe a notificação em tempo real, sem recarregar.
  await expect(bell).toHaveAccessibleName("Notificações, 1 não lida");
  await expect(ana.page.getByRole("link", { name: /Nova notificação/ })).toBeVisible();
  await bell.click();
  await expect(ana.page).toHaveURL(/\/notificacoes$/);
  const item = ana.page.getByRole("listitem").filter({ hasText: "Bruno começou a seguir você" });
  await expect(item).toBeVisible();
  await expect(item.getByRole("button", { name: `Seguir @${bruno.username}` })).toHaveText("Seguir de volta");
  // Abrir a página marca como lida e zera o sino.
  await expect(bell).toHaveAccessibleName("Notificações");

  // Agora a pergunta da Ana aparece no início do Bruno.
  await bruno.page.goto("/", { waitUntil: "networkidle" });
  await expect(bruno.page.getByRole("region", { name: "Seu início" }).getByRole("link", { name: title })).toBeVisible();

  // E a busca do topo encontra a pergunta.
  await bruno.page.getByRole("searchbox", { name: "Buscar" }).fill(token);
  await bruno.page.keyboard.press("Enter");
  await expect(bruno.page).toHaveURL(new RegExp(`/busca\\?q=${token}`));
  await expect(bruno.page.getByText(`1 resultado para “${token}”`)).toBeVisible();
  await expect(bruno.page.getByRole("link", { name: title })).toBeVisible();
});

test("editar o perfil e ver os links e tecnologias", async ({ browser }) => {
  test.setTimeout(90_000);
  const { page, username } = await newMember(browser, "Carla");
  await page.goto(`/@${username}`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Editar perfil" }).click();
  await expect(page.getByRole("heading", { name: "Editar perfil" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Bio").fill("Back-end e bancos de dados.");
  await page.getByLabel("Site").fill("javascript:alert(1)");
  await page.getByText("postgresql", { exact: true }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Use um endereço que comece com https://.")).toBeVisible();

  await page.getByLabel("Site").fill("https://carla.dev");
  await page.getByLabel("GitHub").fill("https://github.com/carla-dev");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(new RegExp(`/@${username}\\?salvo=1$`));
  await expect(page.getByText("Perfil atualizado.")).toBeVisible();
  await expect(page.getByText("Back-end e bancos de dados.")).toBeVisible();
  await expect(page.getByRole("link", { name: "github.com/carla-dev" })).toHaveAttribute("href", "https://github.com/carla-dev");
  await expect(page.getByRole("link", { name: "carla.dev" })).toHaveAttribute("href", "https://carla.dev");
  await expect(page.getByRole("link", { name: "postgresql", exact: true })).toHaveAttribute("href", "/tags/postgresql");
});
