import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.ADMIN_EMAIL ?? "admin@barriolatino.fr";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "demo-epicerie-2026";
const NAME = `Produit Test ${Date.now().toString(36)}`;

async function login(page: Page) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
}

async function publicCard(page: Page) {
  await page.goto(`/catalogue?q=${encodeURIComponent(NAME)}`);
  return page.locator("article", { hasText: NAME });
}

async function inlinePrice(page: Page, kind: "prix" | "prix promo", value: string) {
  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await page.getByRole("button", { name: new RegExp(`Modifier le ${kind} de ${NAME}`) }).click();
  const input = page.getByLabel(new RegExp(`^${kind === "prix" ? "Prix" : "Prix promo"} de ${NAME}`));
  await input.fill(value);
  await input.press("Enter");
  await expect(page.getByRole("status")).toContainText(kind === "prix" ? "Prix enregistré" : "Promotion");
}

test.describe.configure({ mode: "serial" });

test("l'administration est protégée", async ({ page, request }) => {
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
  const res = await request.get("/admin/export/produits.csv", { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(res.status());
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("incorrect");
});

test("scénario critique : créer, publier, changer le prix, promo, désactiver", async ({ page }) => {
  await login(page);

  // 1-4. Créer « Produit Test » à 5 €, avec une image, et publier
  await page.goto("/admin/products/new");
  await page.getByRole("button", { name: "Publier le produit" }).click();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("Nom obligatoire");
  await page.getByLabel("Nom *").fill(NAME);
  await page.getByLabel("Catégorie *").selectOption({ label: "Arepas & galettes" });
  await page.getByLabel("Prix de vente (€) *").fill("-2");
  await page.getByRole("button", { name: "Publier le produit" }).click();
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("négatif");
  await expect(page.getByLabel("Nom *")).toHaveValue(NAME); // la saisie est conservée
  await page.getByLabel("Prix de vente (€) *").fill("5");
  await page.getByLabel("Poids net (g)").fill("500");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "produit-test.webp",
    mimeType: "image/webp",
    buffer: readFileSync(path.join(__dirname, "..", "public", "logo.webp")),
  });
  await expect(page.getByText("Principale")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Publier le produit" }).click();
  await expect(page).toHaveURL(/\/admin\/products\?saved=/);

  // 5. Présent dans le catalogue public, avec sa photo et son prix
  let card = await publicCard(page);
  await expect(card).toBeVisible();
  await expect(card).toContainText("5,00 €");
  await expect(card).toContainText("soit 10,00 €/kg");
  await expect(card.locator("img")).toHaveAttribute("src", /\.webp$/);

  // 6-7. Prix → 6 € depuis le tableau ; le prix public suit, partout
  await inlinePrice(page, "prix", "6");
  card = await publicCard(page);
  await expect(card).toContainText("6,00 €");
  await card.getByRole("link", { name: NAME }).click();
  await expect(page.getByText("6,00 €").first()).toBeVisible();

  // 8-10. Promotion à 4,90 € : ancien prix barré et économie affichée
  await inlinePrice(page, "prix promo", "4,90");
  card = await publicCard(page);
  await expect(card).toContainText("4,90 €");
  await expect(card).toContainText("6,00 €");
  await expect(card).toContainText("Vous économisez 1,10 €");
  await expect(card).toContainText("−18 %");
  await page.goto("/promotions");
  await expect(page.locator("article", { hasText: NAME })).toBeVisible();

  // 11-12. Désactivation : badge « Indisponible », puis masquage selon le paramètre
  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await page.getByRole("switch", { name: `Disponibilité de ${NAME}` }).click();
  await expect(page.getByRole("status")).toContainText("Enregistré");
  card = await publicCard(page);
  await expect(card).toContainText("Indisponible");
  await expect(card.getByText("Indisponible")).toBeVisible();

  await page.goto("/admin/settings");
  await page.getByLabel("Les masquer du catalogue public").check();
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expect(page.getByRole("status")).toContainText("Paramètres enregistrés");
  card = await publicCard(page);
  await expect(card).toHaveCount(0);
  await page.goto("/admin/settings");
  await page.getByLabel("Les montrer avec la mention").check();
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expect(page.getByRole("status")).toContainText("Paramètres enregistrés");

  // Dépublier : le produit disparaît du site
  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await page.getByRole("switch", { name: `Publication de ${NAME}` }).click();
  await expect(page.getByRole("status")).toContainText("Enregistré");
  card = await publicCard(page);
  await expect(card).toHaveCount(0);

  // Historique des prix
  await page.goto(`/admin/price-history?q=${encodeURIComponent(NAME)}`);
  await expect(page.getByRole("row", { name: /5,00 €.*6,00 €/ })).toBeVisible();
});

test("dupliquer, supprimer, restaurer", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await page.getByLabel(`Plus d'actions pour ${NAME}`, { exact: true }).click();
  await page.getByRole("button", { name: "Dupliquer" }).click();
  await expect(page).toHaveURL(/duplicated=1/);
  await expect(page.getByLabel("Nom *")).toHaveValue(`${NAME} (copie)`);
  await page.getByLabel("Nom *").fill(`${NAME} 1 kg`);
  await page.getByLabel("Poids net (g)").fill("1000");
  await page.getByLabel("Prix de vente (€) *").fill("9,50");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page).toHaveURL(/saved=/);

  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await expect(page.getByRole("link", { name: `${NAME} 1 kg` })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByLabel(`Plus d'actions pour ${NAME} 1 kg`, { exact: true }).click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByRole("status")).toContainText("corbeille");

  await page.goto("/admin/products?statut=corbeille");
  const row = page.locator("li", { hasText: `${NAME} 1 kg` });
  await row.getByRole("button", { name: "Restaurer" }).click();
  await expect(page.getByRole("status")).toContainText("restauré");
  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await expect(page.getByRole("link", { name: `${NAME} 1 kg` })).toBeVisible();
});

test("export puis import CSV avec prévisualisation", async ({ page }) => {
  await login(page);
  const exp = await page.request.get("/admin/export/produits.csv");
  expect(exp.ok()).toBeTruthy();
  const csv = await exp.text();
  expect(csv).toContain("Référence;Nom;Marque");
  expect(csv).toContain(NAME);

  const ref = `T-${Date.now().toString(36)}`;
  const file = [
    "Référence;Nom;Marque;Catégorie;Pays;Poids (g);Prix;Prix promo;Disponible",
    `${ref};${NAME} importé;Marque Test;Arepas & galettes;Colombie;250;2,50;;oui`,
    `;Ligne sans prix;;Arepas & galettes;;;;;oui`,
  ].join("\n");
  await page.goto("/admin/import");
  await page.locator('input[name="file"]').setInputFiles({ name: "import.csv", mimeType: "text/csv", buffer: Buffer.from(file) });
  await page.getByRole("button", { name: "Prévisualiser l'import" }).click();
  await expect(page.getByText("nouveaux")).toBeVisible();
  await expect(page.getByText("Prix obligatoire")).toBeVisible();
  await page.getByRole("button", { name: /Importer 1 produit/ }).click();
  await expect(page.getByText("Import terminé")).toBeVisible();

  // Réimport : mise à jour du prix par référence (seules 2 colonnes)
  await page.getByRole("button", { name: "Importer un autre fichier" }).click();
  await page.locator('input[name="file"]').setInputFiles({ name: "prix.csv", mimeType: "text/csv", buffer: Buffer.from(`Référence;Prix\n${ref};2,90`) });
  await page.getByRole("button", { name: "Prévisualiser l'import" }).click();
  await expect(page.getByText("Mise à jour")).toBeVisible();
  await page.getByRole("button", { name: /Importer 1 produit/ }).click();
  await expect(page.getByText("Import terminé")).toBeVisible();

  const card = await publicCard(page);
  await expect(card.filter({ hasText: "importé" })).toContainText("2,90 €");
  await expect(card.filter({ hasText: "importé" })).toContainText("Marque Test");
});

test("nettoyage des produits de test", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/products?q=${encodeURIComponent(NAME)}`);
  await page.getByLabel("Tout sélectionner").check();
  page.once("dialog", (d) => d.accept());
  await page.locator(".sticky").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByRole("status")).toContainText("corbeille");
});
