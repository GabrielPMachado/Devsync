import { expect, test } from "@playwright/test";
import { newMember } from "./helpers/session";

test("perguntar, responder, votar, pedir detalhes, aceitar e ver o histórico", async ({ browser }) => {
  test.setTimeout(120_000);
  const title = `Por que meu useEffect roda duas vezes? ${Date.now().toString(36)}`;

  // Ana pergunta.
  const ana = await newMember(browser, "Ana");
  await ana.page.goto("/estudos", { waitUntil: "networkidle" });
  await ana.page.getByRole("link", { name: "Fazer pergunta" }).click();
  await expect(ana.page.getByRole("heading", { name: "Fazer pergunta" })).toBeVisible();
  await ana.page.waitForLoadState("networkidle");

  // Validação antes de gravar.
  await ana.page.getByLabel("Título").fill("Curto");
  await ana.page.getByRole("button", { name: "Publicar pergunta" }).click();
  await expect(ana.page.getByText("Use pelo menos 10 caracteres no título.")).toBeVisible();
  await expect(ana.page.getByText("Escolha pelo menos 1 tag.")).toBeVisible();

  await ana.page.getByLabel("Título").fill(title);
  await ana.page.getByLabel("Detalhes").fill("Coloquei um log:\n\n```tsx\nuseEffect(() => console.log('oi'), [])\n```");
  await ana.page.getByRole("button", { name: "Visualizar" }).click();
  await expect(ana.page.locator("pre code.hljs")).toBeVisible();
  await ana.page.getByLabel("Tags").fill("react, iniciante");
  await ana.page.getByRole("button", { name: "Publicar pergunta" }).click();

  await expect(ana.page).toHaveURL(/\/estudos\/por-que-meu-useeffect/);
  await expect(ana.page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(ana.page.getByText("Ainda não há respostas")).toBeVisible();
  const questionUrl = ana.page.url();

  // Aparece na lista, inclusive filtrando pela tag.
  await ana.page.goto("/estudos?tag=iniciante");
  await expect(ana.page.getByRole("link", { name: title })).toBeVisible();

  // Bruno responde (a tag iniciante lembra de ter paciência).
  const bruno = await newMember(browser, "Bruno");
  await bruno.page.goto(questionUrl, { waitUntil: "networkidle" });
  await expect(bruno.page.getByText("Quem perguntou está começando.")).toBeVisible();
  await bruno.page.getByPlaceholder("Explique o porquê, não só o código.").fill("É o **Strict Mode** do React no modo dev. Em produção roda uma vez.");
  await bruno.page.getByLabel("Versão da tecnologia").fill("React 19");
  await bruno.page.getByRole("button", { name: "Publicar resposta" }).click();
  await expect(bruno.page.getByText("Resposta publicada. Obrigado por ajudar!")).toBeVisible();
  const answer = bruno.page.getByRole("article", { name: "Resposta de Bruno" });
  await expect(answer.getByText("Strict Mode")).toBeVisible();
  await expect(bruno.page.getByRole("heading", { name: "1 resposta" })).toBeVisible();
  // Ninguém vota na própria resposta.
  await expect(answer.getByRole("button", { name: "Votar a favor" })).toHaveCount(0);

  // Carla vota e pede mais detalhes na pergunta.
  const carla = await newMember(browser, "Carla");
  await carla.page.goto(questionUrl, { waitUntil: "networkidle" });
  const seen = carla.page.getByRole("article", { name: "Resposta de Bruno" });
  await seen.getByRole("button", { name: "Votar a favor" }).click();
  await expect(seen.getByLabel("Pontuação")).toHaveText("1");
  await expect(seen.getByRole("button", { name: "Retirar voto" })).toBeVisible();
  await carla.page.getByRole("button", { name: "Precisa de mais detalhes" }).click();
  await expect(carla.page.getByRole("button", { name: "Pedido de detalhes enviado" })).toBeVisible();

  // Ana vê o pedido educado, aceita a resposta e edita a pergunta.
  await ana.page.goto(questionUrl, { waitUntil: "networkidle" });
  await expect(ana.page.getByText("1 pessoa pediu mais detalhes")).toBeVisible();
  const forAna = ana.page.getByRole("article", { name: "Resposta de Bruno" });
  await forAna.getByRole("button", { name: "Aceitar resposta" }).click();
  await expect(forAna.getByText("Resposta aceita", { exact: true })).toBeVisible();

  await ana.page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(ana.page.getByRole("heading", { name: "Editar pergunta" })).toBeVisible();
  await ana.page.waitForLoadState("networkidle");
  await ana.page.getByLabel("Título").fill(`${title} (Next.js)`);
  await ana.page.getByRole("button", { name: "Salvar edição" }).click();
  await expect(ana.page.getByRole("heading", { level: 1, name: `${title} (Next.js)` })).toBeVisible();
  await ana.page.getByRole("link", { name: "Ver histórico" }).click();
  await expect(ana.page.getByRole("heading", { name: "Histórico de edições" })).toBeVisible();
  await expect(ana.page.getByText(title, { exact: true })).toBeVisible();

  // Visitante lê, mas é convidado a entrar para responder.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(questionUrl);
  await expect(visitor.getByText("Entre para responder, votar e marcar respostas.")).toBeVisible();
  await expect(visitor.getByRole("article", { name: "Resposta de Bruno" }).getByText("Resposta aceita", { exact: true })).toBeVisible();
});
