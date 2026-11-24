import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers/session";

// Tamanho de um iPhone. Nenhuma tela pode ficar mais larga que isso: quando fica,
// o Safari reduz o zoom da página inteira e tudo aparece minúsculo.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.describe.configure({ timeout: 120_000 });

async function expectNoHorizontalOverflow(page: Page, path: string) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, `${path} está ${scroll - width}px mais larga que a tela`).toBeLessThanOrEqual(width);
}

const longDescription =
  "App de organização pessoal para iPhone com módulos que podem ser ligados e desligados, captura de tarefas em linguagem natural e o visual Liquid Glass do iOS 26. Feito com Expo e React Native.";

test("publicar projeto cabe na tela do celular com a lista do GitHub aberta", async ({ page }) => {
  await page.route("https://api.github.com/users/**", (route) =>
    route.fulfill({
      json: [
        {
          name: "Orbita",
          full_name: "ana/Orbita",
          description: longDescription,
          html_url: "https://github.com/ana/Orbita",
          homepage: null,
          language: "TypeScript",
          fork: false,
          pushed_at: "2026-11-20T10:00:00Z",
          default_branch: "main",
        },
      ],
    }),
  );
  await signUp(page, "cel", "Celia Dev");
  await page.goto("/projetos/novo");
  await expect(page.getByRole("heading", { name: "Publicar projeto" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "/projetos/novo");

  await page.getByRole("button", { name: "Escolher repositório" }).click();
  await page.getByLabel("Usuário do GitHub").fill("ana");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("button", { name: "Usar Orbita" })).toBeVisible();
  await expectNoHorizontalOverflow(page, "/projetos/novo (lista do GitHub)");

  for (const path of ["/", "/projetos", "/estudos", "/explorar", "/notificacoes", "/configuracoes"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page, path);
  }
});
