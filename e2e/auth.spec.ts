import { expect, test, type Page } from "@playwright/test";
import { latestLinkFor, uniqueEmail } from "./helpers/mailpit";

async function requestLink(page: Page, email: string) {
  // Espera a página hidratar: o formulário usa useActionState.
  await page.goto("/entrar", { waitUntil: "networkidle" });
  const since = new Date();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  return latestLinkFor(email, since);
}

test.describe("login com link mágico", () => {
  test("primeiro acesso: link → @usuário → início → sair → entrar de novo", async ({ page }) => {
    const email = uniqueEmail("ana");
    const username = `ana_${Date.now().toString(36)}`;

    const link = await requestLink(page, email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/boas-vindas$/);
    await expect(page.getByRole("heading", { name: "Escolha seu @usuário" })).toBeVisible();

    // Tenta outra página do app antes de escolher o @: volta para /boas-vindas.
    await page.goto("/estudos");
    await expect(page).toHaveURL(/\/boas-vindas$/);

    await page.getByLabel("Nome").fill("Ana Souza");
    await page.getByLabel("@usuário").fill(`@${username.toUpperCase()}`);
    await expect(page.getByText(`@${username} está disponível`)).toBeVisible();
    for (const tag of ["react", "typescript", "css"]) await page.getByText(tag, { exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Olá, Ana Souza!")).toBeVisible();
    await page.getByRole("button", { name: "Menu da conta" }).click();
    await expect(page.getByText(`@${username}`)).toBeVisible();

    await page.getByRole("link", { name: "Meu perfil" }).click();
    await expect(page).toHaveURL(new RegExp(`/@${username}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Ana Souza" })).toBeVisible();

    await page.getByRole("button", { name: "Menu da conta" }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();

    // Segunda vez: já tem @, vai direto para o início.
    await page.goto(await requestLink(page, email));
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Olá, Ana Souza!")).toBeVisible();
  });

  test("link já usado volta para /entrar com aviso", async ({ page }) => {
    const email = uniqueEmail("bruno");
    const link = await requestLink(page, email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/boas-vindas$/);
    await page.context().clearCookies();
    await page.goto(link);
    await expect(page).toHaveURL(/\/entrar\?erro=link$/);
    await expect(page.getByText("Esse link de acesso venceu ou já foi usado. Peça um novo.")).toBeVisible();
  });

  test("@usuário já usado aparece na hora", async ({ page }) => {
    const first = uniqueEmail("c1");
    const taken = `cami_${Date.now().toString(36)}`;
    await page.goto(await requestLink(page, first));
    await page.getByLabel("Nome").fill("Camila");
    await page.getByLabel("@usuário").fill(taken);
    for (const tag of ["react", "typescript", "css"]) await page.getByText(tag, { exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.context().clearCookies();
    await page.goto(await requestLink(page, uniqueEmail("c2")));
    await page.getByLabel("@usuário").fill(taken);
    await expect(page.getByText(`@${taken} já está em uso. Tente outro.`)).toBeVisible();
  });

  test("e-mail inválido mostra erro no campo", async ({ page }) => {
    await page.goto("/entrar", { waitUntil: "networkidle" });
    await page.getByLabel("E-mail").fill("nao-e-email");
    await page.getByRole("button", { name: "Enviar link de acesso" }).click();
    await expect(page.getByLabel("E-mail")).toHaveAccessibleDescription("Digite um e-mail válido.");
  });
});

test("foto de perfil de 1,5 MB é enviada no primeiro acesso", async ({ page }) => {
  const email = uniqueEmail("foto");
  const username = `foto_${Date.now().toString(36)}`;
  await page.goto("/entrar", { waitUntil: "networkidle" });
  const since = new Date();
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link de acesso" }).click();
  await page.goto(await latestLinkFor(email, since));

  // PNG válido (1x1) com bytes extras no fim até ~1,5 MB: acima do limite padrão de 1 MB das Server Actions.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const buffer = Buffer.concat([png, Buffer.alloc(1.5 * 1024 * 1024)]);
  await page.locator('input[type="file"][name="avatar"]').setInputFiles({ name: "eu.png", mimeType: "image/png", buffer });
  await page.getByLabel("Nome").fill("Foto Teste");
  await page.getByLabel("@usuário").fill(username);
  for (const tag of ["react", "typescript", "css"]) await page.getByText(tag, { exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto(`/@${username}`);
  await expect(page.getByRole("article").getByRole("img", { name: "Foto Teste" })).toHaveAttribute("src", /\/storage\/v1\/object\/public\/avatars\//);
});

test("visitante em /boas-vindas e /notificacoes vai para /entrar", async ({ page }) => {
  await page.goto("/boas-vindas");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fboas-vindas$/);
  await page.goto("/notificacoes");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fnotificacoes$/);
});

test("Continuar com GitHub leva à autorização do GitHub", async ({ page }) => {
  // O Supabase responde com um redirecionamento para o GitHub; a página do GitHub em si não interessa.
  await page.route("https://github.com/**", (route) => route.fulfill({ status: 200, body: "github" }));
  await page.goto("/entrar");
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().startsWith("https://github.com/login/oauth/authorize")),
    page.getByRole("button", { name: "Continuar com GitHub" }).click(),
  ]);
  const url = new URL(request.url());
  expect(url.searchParams.get("redirect_uri")).toContain("/auth/v1/callback");
  expect(url.searchParams.get("redirect_to")).toContain("/auth/callback?next=%2F");
});

test("celular: barra de cima e 5 abas embaixo", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/estudos");
  const tabs = page.getByRole("navigation", { name: "Abas" });
  await expect(tabs.getByRole("link")).toHaveText(["Início", "Projetos", "Estudos", "Notificações", "Perfil"]);
  await expect(tabs.getByRole("link", { name: "Estudos" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeHidden();
  await context.close();
});
