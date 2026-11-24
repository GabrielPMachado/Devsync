import { expect, test } from "@playwright/test";
import { adminEnv, makeAdmin } from "./helpers/admin";
import { newMember } from "./helpers/session";

test("denúncia → fila do /admin → ocultar → some para os outros", async ({ browser }) => {
  test.skip(!adminEnv(), "Precisa de E2E_SUPABASE_URL e E2E_SUPABASE_SERVICE_ROLE_KEY (Supabase local)");
  test.setTimeout(120_000);
  const title = `Como centralizar uma div no CSS? ${Date.now().toString(36)}`;
  const rude = `Pergunta boba, pesquisa no Google ${Date.now().toString(36)}`;

  // Ana pergunta e Bruno responde de forma grosseira.
  const ana = await newMember(browser, "Ana");
  await ana.page.goto("/estudos/perguntar", { waitUntil: "networkidle" });
  await ana.page.getByLabel("Título").fill(title);
  await ana.page.getByLabel("Detalhes").fill("Tentei margin auto e não deu.");
  await ana.page.getByLabel("Tags").fill("css, iniciante");
  await ana.page.getByRole("button", { name: "Publicar pergunta" }).click();
  await expect(ana.page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const questionUrl = ana.page.url();

  const bruno = await newMember(browser, "Bruno");
  await bruno.page.goto(questionUrl, { waitUntil: "networkidle" });
  await bruno.page.getByPlaceholder("Explique o porquê, não só o código.").fill(rude);
  await bruno.page.getByRole("button", { name: "Publicar resposta" }).click();
  await expect(bruno.page.getByText("Resposta publicada. Obrigado por ajudar!")).toBeVisible();
  // Quem escreveu não vê "Denunciar" na própria resposta.
  await expect(bruno.page.getByRole("article", { name: "Resposta de Bruno" }).getByRole("button", { name: "Denunciar resposta" })).toHaveCount(0);

  // Ana denuncia a resposta.
  await ana.page.reload({ waitUntil: "networkidle" });
  const answer = ana.page.getByRole("article", { name: "Resposta de Bruno" });
  await answer.getByRole("button", { name: "Denunciar resposta" }).click();
  const dialog = ana.page.getByRole("dialog", { name: "Denunciar resposta" });
  await dialog.getByLabel("Grosseria ou ofensa").check();
  await dialog.getByLabel("Detalhes (opcional)").fill("Debochou de quem está começando.");
  await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(dialog.getByText("Obrigado. A moderação vai analisar.")).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar" }).first().click();

  // Quem não é admin não acha o /admin.
  await bruno.page.goto("/admin", { waitUntil: "networkidle" });
  await expect(bruno.page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(bruno.page.getByRole("heading", { name: "Moderação" })).toHaveCount(0);

  // O moderador vê a denúncia agrupada e oculta a resposta.
  const mod = await newMember(browser, "Gabriel");
  await makeAdmin(mod.username);
  await mod.page.goto("/admin", { waitUntil: "networkidle" });
  await expect(mod.page.getByRole("heading", { level: 1, name: "Moderação" })).toBeVisible();
  const item = mod.page.getByRole("article").filter({ hasText: rude });
  await expect(item.getByText("1 denúncia")).toBeVisible();
  await expect(item.getByText("Grosseria ou ofensa: Debochou de quem está começando.")).toBeVisible();
  await item.getByRole("button", { name: "Ocultar" }).click();
  await expect(mod.page.getByRole("article").filter({ hasText: rude })).toHaveCount(0);

  // Na aba Resolvidas dá para desfazer.
  await mod.page.goto("/admin?aba=resolvidas", { waitUntil: "networkidle" });
  await expect(mod.page.getByRole("article").filter({ hasText: rude }).getByRole("button", { name: "Mostrar de novo" })).toBeVisible();

  // A resposta some para os outros.
  await ana.page.reload({ waitUntil: "networkidle" });
  await expect(ana.page.getByText(rude)).toHaveCount(0);
  await expect(ana.page.getByText("Ainda não há respostas")).toBeVisible();
});
