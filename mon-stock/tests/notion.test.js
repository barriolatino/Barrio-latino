// Le connecteur Notion, essayé contre l'imitation de l'API (jamais contre le vrai Notion).
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerFauxNotion } from "./faux-notion.js";
import { creerMagasinNotion } from "../server/magasin-notion.js";
import { creerOperations } from "../public/js/core/operations.js";
import { BASES, P } from "../server/config-notion.js";

function monter() {
  const notion = creerFauxNotion();
  const pisco = notion.ajouterProduit("restaurant", { nom: "Pisco", stockMinimum: 2, categorie: "Alcools" });
  const modelo = notion.ajouterProduit("restaurant", { nom: "Cerveza Modelo", stockMinimum: 24 });
  const tajin = notion.ajouterProduit("epicerie", { nom: "Tajín", unite: "flacon", stockMinimum: 4, prixVente: 6 });
  notion.ajouterMouvement("restaurant", pisco, { quantite: 5, apres: 5 });
  notion.ajouterMouvement("restaurant", modelo, { quantite: 20, apres: 20 });
  notion.ajouterMouvement("epicerie", tajin, { quantite: 10, apres: 10 });
  const magasin = creerMagasinNotion({ jeton: notion.jeton, fetch: notion.fetch, attente: async () => {} });
  magasin.delaiRelectureMs = 0;
  return { notion, magasin, ops: creerOperations(magasin), ids: { pisco, modelo, tajin } };
}
let n = 0;
const cle = () => `notion-essai-${++n}-${Date.now()}`;

test("chaque appel porte la clé et la version de l'API", async () => {
  const { notion, ops } = monter();
  await ops.produits({ activite: "restaurant" });
  assert.ok(notion.journal.length > 0);
  for (const j of notion.journal) {
    assert.match(j.entetes.Authorization, /^Bearer /);
    assert.equal(j.entetes["Notion-Version"], "2025-09-03");
  }
});

test("liste des produits : quantités et statuts calculés comme dans Notion", async () => {
  const { ops } = monter();
  const r = await ops.produits({ activite: "restaurant" });
  assert.equal(r.statut, 200);
  const parNom = Object.fromEntries(r.corps.produits.map((p) => [p.nom, p]));
  assert.equal(parNom.Pisco.quantite, 5);
  assert.equal(parNom.Pisco.statut, "ok");
  assert.equal(parNom["Cerveza Modelo"].statut, "faible");
  assert.ok(r.corps.produits.every((p) => p.activite === "restaurant"));
});

test("sortie : page créée dans l'historique avec les bonnes propriétés, puis validée", async () => {
  const { notion, ops, ids } = monter();
  const k = cle();
  const r = await ops.enregistrer({ cle: k, activite: "restaurant", produitId: ids.pisco, type: "sortie", quantite: 2, stockAttendu: 5, motif: "Service du soir" });
  assert.equal(r.statut, 201, JSON.stringify(r.corps));
  assert.equal(r.corps.produit.quantite, 3);
  assert.equal(r.corps.mouvement.numero, 4);
  const page = notion.mouvements().find((m) => m.valeurs[P.mouvement.cle] === k);
  assert.equal(page.valeurs[P.mouvement.activite], "Restaurant");
  assert.equal(page.valeurs[P.mouvement.type], "Sortie");
  assert.equal(page.valeurs[P.mouvement.statut], "Validé");
  assert.equal(page.valeurs[P.mouvement.stockAvant], 5);
  assert.equal(page.valeurs[P.mouvement.stockApres], 3);
  assert.equal(page.valeurs[P.mouvement.motif], "Service du soir");
  assert.deepEqual(page.valeurs[P.mouvement.produit.restaurant], [ids.pisco]);
  assert.equal(page.valeurs[P.mouvement.produit.epicerie], undefined);
});

test("même clé deux fois puis trois fois en même temps : un seul mouvement validé", async () => {
  const { notion, ops, ids } = monter();
  const k = cle();
  const op = { cle: k, activite: "epicerie", produitId: ids.tajin, type: "sortie", quantite: 1 };
  await ops.enregistrer(op);
  assert.equal((await ops.enregistrer(op)).corps.doublon, true);
  const k2 = cle();
  await Promise.all([1, 2, 3].map(() => ops.enregistrer({ ...op, cle: k2 })));
  const valides = notion.mouvements().filter((m) => [k, k2].includes(m.valeurs[P.mouvement.cle]) && m.valeurs[P.mouvement.statut] === "Validé");
  assert.equal(valides.length, 2);
  const r = await ops.produits({ activite: "epicerie" });
  assert.equal(r.corps.produits[0].quantite, 8);
});

test("séparation : un produit de l'épicerie est refusé côté restaurant, rien n'est écrit", async () => {
  const { notion, ops, ids } = monter();
  const avant = notion.mouvements().length;
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: ids.tajin, type: "sortie", quantite: 1 });
  assert.equal(r.statut, 404);
  assert.equal(notion.mouvements().length, avant);
});

test("sortie supérieure au stock : refusée sans écriture", async () => {
  const { notion, ops, ids } = monter();
  const avant = notion.mouvements().length;
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: ids.pisco, type: "sortie", quantite: 6 });
  assert.equal(r.corps.erreur.code, "STOCK_INSUFFISANT");
  assert.equal(notion.mouvements().length, avant);
});

test("plus de 25 mouvements : la quantité reste exacte", async () => {
  const { notion, ops } = monter();
  const id = notion.ajouterProduit("restaurant", { nom: "Inca Kola", stockMinimum: 5 });
  for (let i = 0; i < 30; i++) notion.ajouterMouvement("restaurant", id, { quantite: 1 });
  const r = await ops.produits({ activite: "restaurant" });
  assert.equal(r.corps.produits.find((p) => p.nom === "Inca Kola").quantite, 30);
  const s = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: id, type: "sortie", quantite: 4, stockAttendu: 30 });
  assert.equal(s.statut, 201);
  assert.equal(s.corps.produit.quantite, 26);
});

test("limite de débit (429) à la création : on attend et on réessaie, un seul mouvement", async () => {
  const { notion, ops, ids } = monter();
  notion.panne((m, c) => m === "POST" && c === "/pages", 429, 2);
  const k = cle();
  const r = await ops.enregistrer({ cle: k, activite: "restaurant", produitId: ids.pisco, type: "entree", quantite: 6 });
  assert.equal(r.statut, 201);
  assert.equal(notion.mouvements().filter((m) => m.valeurs[P.mouvement.cle] === k).length, 1);
});

test("création qui échoue (réseau) : jamais rejouée en douce, NON ENREGISTRÉ", async () => {
  const { notion, ops, ids } = monter();
  notion.panne((m, c) => m === "POST" && c === "/pages", "reseau", 1);
  const avant = notion.mouvements().length;
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: ids.pisco, type: "sortie", quantite: 1 });
  assert.equal(r.statut, 502);
  assert.equal(notion.mouvements().length, avant);
});

test("validation impossible : le mouvement reste sans effet, stock inchangé", async () => {
  const { notion, ops, ids } = monter();
  notion.panne((m) => m === "PATCH", 500, 10);
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: ids.pisco, type: "sortie", quantite: 1 });
  assert.equal(r.statut, 502);
  const derniere = notion.mouvements().at(-1);
  assert.notEqual(derniere.valeurs[P.mouvement.statut], "Validé");
  assert.equal(await (await import("../server/magasin-notion.js")).creerMagasinNotion({ jeton: notion.jeton, fetch: notion.fetch }).stock("restaurant", ids.pisco), 5);
});

test("validation qui échoue une fois (500) : rejouée, réussite", async () => {
  const { notion, ops, ids } = monter();
  notion.panne((m) => m === "PATCH", 500, 1);
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: ids.pisco, type: "sortie", quantite: 1 });
  assert.equal(r.statut, 201);
});

test("correction : ancienne et nouvelle quantité dans Notion", async () => {
  const { notion, ops, ids } = monter();
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: ids.modelo, type: "correction", nouvelleQuantite: 18, motif: "Inventaire" });
  assert.equal(r.statut, 201);
  const m = notion.mouvements().at(-1);
  assert.equal(m.valeurs[P.mouvement.type], "Correction");
  assert.equal(m.valeurs[P.mouvement.stockAvant], 20);
  assert.equal(m.valeurs[P.mouvement.stockApres], 18);
});

test("historique : filtres activité, type, période ; noms de produits retrouvés", async () => {
  const { ops, ids } = monter();
  await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: ids.pisco, type: "sortie", quantite: 1 });
  const r = await ops.mouvements({ activite: "restaurant", type: "sortie" });
  assert.equal(r.corps.mouvements.length, 1);
  assert.equal(r.corps.mouvements[0].produitNom, "Pisco");
  assert.equal(r.corps.mouvements[0].unite, "bouteille");
  const tous = await ops.mouvements({ depuis: new Date(Date.now() - 86400_000).toISOString() });
  assert.equal(tous.corps.mouvements.length, 4);
});

test("contrôle : concordance, puis écart Notion/mouvements et mouvement incohérent détectés", async () => {
  const { notion, ops, ids } = monter();
  assert.equal((await ops.controle()).corps.ok, true);
  notion.fausserRollup(1);
  const c1 = await ops.controle();
  assert.equal(c1.corps.ok, false);
  assert.match(c1.corps.problemes[0].message, /Notion affiche/);
  notion.fausserRollup(0);
  notion.ajouterMouvement("restaurant", ids.pisco, { quantite: 1, statut: "Annulé", activiteNotion: "Épicerie" });
  const c2 = await ops.controle();
  assert.ok(c2.corps.problemes.some((p) => /incohérents/.test(p.message)));
});

test("le connecteur vise les trois bases de GESTION DES STOCKS", () => {
  assert.equal(BASES.restaurant, "41c46841-205f-814f-94a7-000b3b69d105");
  assert.equal(BASES.epicerie, "41c46841-205f-819c-ac61-000b9e067240");
  assert.equal(BASES.historique, "41c46841-205f-8125-ae4c-000be3de819e");
});

test("contrôle : nombre de requêtes Notion limité même avec beaucoup de produits", async () => {
  const { notion, ops } = monter();
  for (let i = 0; i < 60; i++) {
    const id = notion.ajouterProduit(i % 2 ? "restaurant" : "epicerie", { nom: `Produit ${i}` });
    notion.ajouterMouvement(i % 2 ? "restaurant" : "epicerie", id, { quantite: 3, apres: 3 });
  }
  const avant = notion.journal.length;
  const c = await ops.controle();
  assert.equal(c.corps.ok, true, JSON.stringify(c.corps.problemes));
  assert.equal(c.corps.produitsVerifies, 63);
  assert.ok(notion.journal.length - avant <= 12, `${notion.journal.length - avant} requêtes`);
});
