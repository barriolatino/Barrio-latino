import { expect, test } from "@playwright/test";

test("accueil : hero, catégories, accès au catalogue", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { name: "Catégories" })).toBeVisible();
  await page.getByRole("link", { name: /Voir le catalogue/ }).click();
  await expect(page).toHaveURL(/\/catalogue$/);
  await expect(page.getByRole("heading", { name: "Catalogue", level: 1 })).toBeVisible();
});

test("recherche instantanée, sans accents", async ({ page }) => {
  await page.goto("/catalogue");
  const search = page.locator("#search-desktop");
  await search.fill("maracuya");
  await expect(page).toHaveURL(/q=maracuya/);
  await expect(page.getByRole("heading", { name: /maracuyá/i }).first()).toBeVisible();
  // Recherche par marque
  await search.fill("goya");
  await expect(page.getByText("Goya ·").first()).toBeVisible();
  // Faute de frappe : résultats approchants
  await search.fill("maracuja");
  await expect(page.getByText(/maracuyá/i).first()).toBeVisible();
});

test("filtres et tri", async ({ page }) => {
  await page.goto("/catalogue");
  await page.getByLabel("En promotion").check();
  await expect(page).toHaveURL(/promo=1/);
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  for (const text of await cards.allInnerTexts()) expect(text).toMatch(/Vous économisez/);
  await page.getByLabel("Trier les produits").selectOption("prix-asc");
  await expect(page).toHaveURL(/tri=prix-asc/);
  await page.getByRole("button", { name: /Retirer le filtre En promotion/ }).click();
  await expect(page).not.toHaveURL(/promo=1/);
});

test("fiche produit : prix, caractéristiques, partage, retour", async ({ page }) => {
  await page.goto("/catalogue?q=pulpe+maracuya");
  await page.getByRole("link", { name: "Pulpe de maracuyá" }).first().click();
  await expect(page).toHaveURL(/\/produits\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("maracuyá");
  await expect(page.getByText(/€/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Caractéristiques" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Partager ce produit/ })).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(ld!)["@type"]).toBe("Product");
  await page.getByRole("link", { name: "Catalogue" }).first().click();
  await expect(page).toHaveURL(/\/catalogue/);
});

test("pages promotions, nouveautés, pays, catégories, contact", async ({ page }) => {
  for (const [path, title] of [["/promotions", "Promotions"], ["/nouveautes", "Nouveautés"], ["/pays", "Produits par pays"], ["/categories", "Catégories"], ["/contact", "Contact"]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  }
  await page.goto("/pays");
  await page.getByRole("link", { name: /Colombie/ }).first().click();
  await expect(page.locator("article").first()).toBeVisible();
});

test("SEO : sitemap et robots", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/produits/");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
});
