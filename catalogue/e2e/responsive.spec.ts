import { expect, test } from "@playwright/test";

const WIDTHS = [375, 768, 1024, 1440];
const PAGES = ["/", "/catalogue", "/categories", "/promotions", "/produits/pulpe-de-maracuya-canoa-90g", "/contact"];

for (const width of WIDTHS) {
  test(`pas de défilement horizontal à ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} à ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test("grille : 2 colonnes à 375px, 4 à 1440px", async ({ page }) => {
  for (const [width, cols] of [[375, 2], [768, 3], [1024, 4], [1440, 4]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/catalogue");
    const tops = await page.locator("article").evaluateAll((els) => els.slice(0, 8).map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(tops.filter((t) => t === tops[0]).length, `${width}px`).toBe(cols);
  }
});

test("menu mobile et recherche à 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: /Promotions/ }).click();
  await expect(page).toHaveURL(/\/promotions/);
  await page.locator("#search-mobile").fill("arepa");
  await page.locator("#search-mobile").press("Enter");
  await expect(page).toHaveURL(/catalogue\?q=arepa/);
  await expect(page.locator("article").first()).toBeVisible();
  await page.getByRole("button", { name: /Filtres/ }).click();
  await expect(page.getByRole("dialog", { name: "Filtres" })).toBeVisible();
});
