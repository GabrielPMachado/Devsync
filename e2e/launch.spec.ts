import { expect, test } from "@playwright/test";

test.describe("lançamento: PWA, SEO e segurança", () => {
  test("cabeçalhos de segurança em todas as páginas", async ({ request }) => {
    for (const path of ["/", "/estudos", "/entrar"]) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"], path).toContain("object-src 'none'");
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    }
  });

  test("a página inicial abre sem erro de CSP no console", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /Content Security Policy/i.test(m.text())) violations.push(m.text());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Estudos" }).first().click();
    await expect(page).toHaveURL(/\/estudos$/);
    expect(violations).toEqual([]);
  });

  test("manifest com nome, ícones e tela cheia", async ({ request, page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ name: "Devsync", short_name: "Devsync", display: "standalone", start_url: "/", lang: "pt-BR" });
    const sizes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
    for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()["content-type"]).toBe("image/png");
  });

  test.describe("com service worker", () => {
    test.use({ serviceWorkers: "allow" });

    test("registra o service worker e guarda a página sem internet", async ({ page, context }) => {
      await page.goto("/");
      const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
      expect(scope).toMatch(/\/$/);
      // Espera o install guardar /offline e então simula a queda da rede.
      await expect.poll(() => page.evaluate(async () => !!(await caches.match("/offline")))).toBe(true);
      await page.reload();
      await context.setOffline(true);
      await page.goto("/estudos").catch(() => {});
      await expect(page.getByRole("heading", { name: "Você está sem internet" })).toBeVisible();
      // Sem rede o CSS do site não carrega: a página precisa do estilo inline.
      await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(7, 11, 20)");
      await context.setOffline(false);
    });
  });

  test("robots aponta para o sitemap e esconde áreas privadas", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /auth/");
  });

  test("sitemap lista as páginas públicas", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBe(true);
    const xml = await res.text();
    expect(xml).toMatch(/<loc>[^<]*\/projetos<\/loc>/);
    expect(xml).toMatch(/<loc>[^<]*\/estudos<\/loc>/);
  });

  test("metadados de compartilhamento e imagem Open Graph", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Devsync");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toBeTruthy();
    const img = await request.get(new URL(og!).pathname);
    expect(img.headers()["content-type"]).toBe("image/png");
  });

  test("página não encontrada amigável", async ({ page }) => {
    const res = await page.goto("/essa-pagina-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o início" })).toBeVisible();
  });
});
