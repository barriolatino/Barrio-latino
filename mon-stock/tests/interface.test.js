// Essais de bout en bout sur un iPhone simulé, contre le serveur d'essai (données fictives).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { demarrer } from "../dev-server.js";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

let serveur, base, navigateur, contexte, page;

const etat = async (action = "etat") => (await fetch(`${base}/__essai/${action}`)).json();
const valides = async () => (await etat()).mouvements.filter((m) => m.statut === "Validé");
const stock = async (activite, id) =>
  (await etat()).mouvements
    .filter((m) => m.activite === activite && m.produitId === id && m.statut === "Validé")
    .reduce((t, m) => t + (m.type === "entree" ? m.quantite : m.type === "sortie" ? -m.quantite : m.stockApres - m.stockAvant), 0);

async function ouvrir(chemin) {
  await page.goto(`${base}/#/vide`);
  await page.goto(`${base}/${chemin}`);
}

async function saisirSortie(produit, quantite, activite = "restaurant") {
  await page.goto(`${base}/#/vide`);
  await page.goto(`${base}/#/mouvement/sortie/${activite}?produit=${produit}`);
  await page.fill("#q", String(quantite));
  await page.click("[data-continuer]");
  await page.waitForSelector("[data-confirmer]");
}

before(async () => {
  serveur = await demarrer({ port: 0 });
  base = `http://localhost:${serveur.address().port}`;
  navigateur = await chromium.launch();
  contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  page = await contexte.newPage();
  await page.goto(`${base}/`);
  await page.waitForSelector("#code");
});

after(async () => {
  await navigateur?.close();
  serveur?.close();
});

beforeEach(async () => {
  await etat("reinitialiser");
  await contexte.setOffline(false);
});

test("code d'accès : refus puis ouverture", async () => {
  await page.fill("#code", "0000");
  await page.click("button[type=submit]");
  await page.waitForSelector(".avis.erreur");
  assert.match(await page.textContent(".avis.erreur"), /Code incorrect/);
  await page.fill("#code", "2468");
  await page.click("button[type=submit]");
  await page.waitForSelector(".espace.t-restaurant");
  assert.equal(await page.locator(".espace").count(), 2);
});

test("API protégée : sans session 401, sans en-tête 403", async () => {
  assert.equal((await fetch(`${base}/api/produits?activite=restaurant`)).status, 401);
  const r = await fetch(`${base}/api/mouvements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(r.status, 403);
});

test("sortie : rien n'est enregistré avant CONFIRMER, puis le stock baisse", async () => {
  const avant = (await valides()).length;
  await saisirSortie("r-modelo", 8);
  assert.equal((await valides()).length, avant, "aucun mouvement à l'écran récapitulatif");
  assert.match(await page.textContent(".recap"), /20 bouteilles[\s\S]*12 bouteilles/);
  await page.click("[data-annuler]");
  await page.waitForURL(/#\/activite\/restaurant/);
  assert.equal((await valides()).length, avant, "ANNULER n'enregistre rien");
  await saisirSortie("r-modelo", 8);
  await page.click("[data-confirmer]");
  await page.waitForSelector(".resultat:not(.echec)");
  assert.equal(await stock("restaurant", "r-modelo"), 12);
  assert.match(await page.textContent(".resultat"), /12 bouteilles/);
  assert.match(await page.textContent("main"), /Stock faible/);
});

test("double appui sur CONFIRMER : un seul mouvement", async () => {
  await etat("lenteur?ms=700");
  const avant = (await valides()).length;
  await saisirSortie("r-pisco", 1);
  const bouton = page.locator("[data-confirmer]");
  await bouton.dblclick();
  await bouton.click({ force: true }).catch(() => {});
  await page.waitForSelector(".resultat");
  assert.equal((await valides()).length, avant + 1);
  assert.equal(await stock("restaurant", "r-pisco"), 4);
});

test("sortie supérieure au stock : bouton bloqué, message clair", async () => {
  await ouvrir("#/mouvement/sortie/restaurant?produit=r-pisco");
  await page.fill("#q", "9");
  assert.equal(await page.isDisabled("[data-continuer]"), true);
  assert.match(await page.textContent("[data-apercu]"), /il ne reste que 5/);
});

test("correction : motif obligatoire, ancienne et nouvelle quantité, écart", async () => {
  await ouvrir("#/mouvement/correction/restaurant?produit=r-modelo");
  await page.fill("#q", "18");
  assert.equal(await page.isDisabled("[data-continuer]"), true, "pas de motif = pas de suite");
  await page.fill("#motif", "Inventaire du soir");
  await page.click("[data-continuer]");
  const recap = await page.textContent(".recap");
  assert.match(recap, /Stock actuel\s*20 bouteilles/);
  assert.match(recap, /Nouvelle quantité\s*18 bouteilles/);
  assert.match(recap, /Différence\s*−2 bouteilles/);
  await page.click("[data-confirmer]");
  await page.waitForSelector(".resultat:not(.echec)");
  const m = (await valides()).at(-1);
  assert.equal(m.type, "correction");
  assert.equal(m.stockAvant, 20);
  assert.equal(m.stockApres, 18);
  assert.equal(m.motif, "Inventaire du soir");
});

test("hors connexion : NON ENREGISTRÉ, et rien n'est renvoyé tout seul au retour du réseau", async () => {
  const avant = (await valides()).length;
  await saisirSortie("r-inca", 2);
  await contexte.setOffline(true);
  await page.click("[data-confirmer]");
  await page.waitForSelector(".resultat.echec");
  assert.match(await page.textContent(".resultat"), /NON ENREGISTRÉ/);
  assert.equal(await page.isVisible("#hors-ligne"), true);
  await contexte.setOffline(false);
  await page.waitForTimeout(1200);
  assert.equal((await valides()).length, avant, "pas d'envoi automatique");
  await page.click("[data-reessayer]");
  await page.waitForSelector("[data-confirmer]");
  assert.equal((await valides()).length, avant, "Réessayer ramène au récapitulatif sans envoyer");
  await page.click("[data-confirmer]");
  await page.waitForSelector(".resultat:not(.echec)");
  assert.equal((await valides()).length, avant + 1);
});

test("panne de Notion pendant l'enregistrement : NON ENREGISTRÉ, stock inchangé", async () => {
  await etat("panne/valider");
  await saisirSortie("r-pisco", 1);
  await page.click("[data-confirmer]");
  await page.waitForSelector(".resultat.echec");
  assert.equal(await stock("restaurant", "r-pisco"), 5);
  assert.equal((await etat()).mouvements.at(-1).statut, "Échec");
});

test("séparation restaurant / épicerie dans les listes et la recherche", async () => {
  await ouvrir("#/mouvement/sortie/restaurant");
  await page.waitForSelector("[data-id]");
  const ids = await page.$$eval("[data-id]", (els) => els.map((e) => e.dataset.id));
  assert.ok(ids.length > 0 && ids.every((id) => id.startsWith("r-")));
  await ouvrir("#/recherche");
  await page.fill("#r", "tajin");
  const groupes = await page.$$eval("section", (els) => els.map((s) => [s.className, s.querySelectorAll(".ligne").length]));
  assert.deepEqual(groupes, [["t-restaurant", 1], ["t-epicerie", 1]]);
});

test("historique : filtre par type et par activité", async () => {
  await saisirSortie("r-pisco", 1);
  await page.click("[data-confirmer]");
  await page.waitForSelector(".resultat:not(.echec)");
  await ouvrir("#/historique");
  await page.click("[data-cle=jours][data-valeur='']");
  await page.click("[data-cle=type][data-valeur=sortie]");
  await page.waitForFunction(() => document.querySelectorAll(".mouvement").length === 1);
  await page.click("[data-cle=activite][data-valeur=epicerie]");
  await page.waitForSelector(".vide");
});

test("alertes : une rupture apparaît dès que le stock tombe à zéro", async () => {
  await saisirSortie("r-pisco", 5);
  assert.match(await page.textContent("main"), /sera en rupture/);
  await page.click("[data-confirmer]");
  await page.waitForSelector(".resultat:not(.echec)");
  await ouvrir("#/alertes?activite=restaurant");
  await page.waitForSelector(".liste");
  assert.match(await page.textContent("main"), /Ruptures \(2\)[\s\S]*Pisco/);
});

test("contrôle : tout concorde sur les données d'essai", async () => {
  await ouvrir("#/controle");
  await page.waitForSelector(".avis");
  assert.match(await page.textContent(".avis"), /Tout concorde/);
});
