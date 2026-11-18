import { test } from "node:test";
import assert from "node:assert/strict";
import { creerMagasinMemoire } from "../public/js/core/magasin-memoire.js";
import { creerOperations } from "../public/js/core/operations.js";
import { calculerOperation, statutStock, avecUnite } from "../public/js/core/regles.js";

const nouveau = () => {
  const magasin = creerMagasinMemoire();
  return { magasin, ops: creerOperations(magasin) };
};
let n = 0;
const cle = () => `essai-${Date.now()}-${++n}`;

test("statut : rupture, faible, suffisant (même règle que Notion)", () => {
  assert.equal(statutStock(0, 5), "rupture");
  assert.equal(statutStock(-1, null), "rupture");
  assert.equal(statutStock(5, 5), "faible");
  assert.equal(statutStock(6, 5), "ok");
  assert.equal(statutStock(1, null), "ok");
});

test("calculs : entrée, sortie, correction, décimales", () => {
  assert.deepEqual(calculerOperation({ type: "entree", stock: 10, quantite: "2,5" }), { avant: 10, apres: 12.5, quantite: 2.5, ecart: 2.5 });
  assert.deepEqual(calculerOperation({ type: "sortie", stock: 0.3, quantite: 0.1 }).apres, 0.2);
  assert.deepEqual(calculerOperation({ type: "correction", stock: 20, nouvelleQuantite: 18, motif: "inventaire" }), { avant: 20, apres: 18, quantite: 2, ecart: -2 });
  assert.throws(() => calculerOperation({ type: "sortie", stock: 3, quantite: 4 }), { code: "STOCK_INSUFFISANT" });
  assert.throws(() => calculerOperation({ type: "sortie", stock: 3, quantite: 0 }), { code: "QUANTITE_NULLE" });
  assert.throws(() => calculerOperation({ type: "entree", stock: 3, quantite: -1 }), { code: "QUANTITE_NEGATIVE" });
  assert.throws(() => calculerOperation({ type: "correction", stock: 3, nouvelleQuantite: 2 }), { code: "MOTIF_OBLIGATOIRE" });
  assert.throws(() => calculerOperation({ type: "correction", stock: 3, nouvelleQuantite: 3, motif: "x" }), { code: "AUCUN_ECART" });
  assert.equal(avecUnite(12, "bouteille"), "12 bouteilles");
  assert.equal(avecUnite(1, "bouteille"), "1 bouteille");
  assert.equal(avecUnite(2.5, "kg"), "2,5 kg");
});

test("sortie validée : stock déduit, mouvement enregistré puis relu", async () => {
  const { ops, magasin } = nouveau();
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: "r-pisco", type: "sortie", quantite: 2, stockAttendu: 5 });
  assert.equal(r.statut, 201);
  assert.equal(r.corps.produit.quantite, 3);
  assert.equal(r.corps.mouvement.statut, "Validé");
  assert.equal(r.corps.mouvement.stockAvant, 5);
  assert.equal(r.corps.mouvement.stockApres, 3);
  assert.equal(await magasin.stock("restaurant", "r-pisco"), 3);
});

test("sortie supérieure au stock : refusée, rien n'est créé", async () => {
  const { ops, magasin } = nouveau();
  const avant = magasin._mouvements.length;
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: "r-pisco", type: "sortie", quantite: 6 });
  assert.equal(r.statut, 422);
  assert.equal(r.corps.erreur.code, "STOCK_INSUFFISANT");
  assert.equal(magasin._mouvements.length, avant);
});

test("même clé envoyée deux fois : un seul mouvement", async () => {
  const { ops, magasin } = nouveau();
  const k = cle();
  const op = { cle: k, activite: "epicerie", produitId: "e-tajin", type: "sortie", quantite: 1, stockAttendu: 10 };
  const r1 = await ops.enregistrer(op);
  const r2 = await ops.enregistrer(op);
  assert.equal(r1.statut, 201);
  assert.equal(r2.statut, 200);
  assert.equal(r2.corps.doublon, true);
  assert.equal(magasin._mouvements.filter((m) => m.cle === k).length, 1);
  assert.equal(await magasin.stock("epicerie", "e-tajin"), 9);
});

test("même clé envoyée en même temps : un seul mouvement validé", async () => {
  const { ops, magasin } = nouveau();
  const k = cle();
  const op = { cle: k, activite: "epicerie", produitId: "e-tajin", type: "sortie", quantite: 1 };
  const rs = await Promise.all([ops.enregistrer(op), ops.enregistrer(op), ops.enregistrer(op)]);
  const valides = magasin._mouvements.filter((m) => m.cle === k && m.statut === "Validé");
  assert.equal(valides.length, 1);
  assert.equal(await magasin.stock("epicerie", "e-tajin"), 9);
  assert.ok(rs.some((r) => r.statut === 201));
});

test("séparation : un produit de l'épicerie est introuvable côté restaurant", async () => {
  const { ops, magasin } = nouveau();
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: "e-tajin", type: "sortie", quantite: 1 });
  assert.equal(r.statut, 404);
  assert.equal(await magasin.stock("epicerie", "e-tajin"), 10);
  const liste = await ops.produits({ activite: "restaurant" });
  assert.ok(liste.corps.produits.every((p) => p.id.startsWith("r-")));
});

test("stock modifié entre l'écran récapitulatif et la confirmation : refusé", async () => {
  const { ops } = nouveau();
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: "r-pisco", type: "sortie", quantite: 1, stockAttendu: 7 });
  assert.equal(r.statut, 409);
  assert.equal(r.corps.erreur.code, "STOCK_CHANGE");
  assert.equal(r.corps.erreur.stock, 5);
});

test("correction : motif obligatoire, ancienne et nouvelle quantité conservées", async () => {
  const { ops, magasin } = nouveau();
  const depart = magasin._mouvements.length;
  const sans = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: "r-modelo", type: "correction", nouvelleQuantite: 18 });
  assert.equal(sans.corps.erreur.code, "MOTIF_OBLIGATOIRE");
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: "r-modelo", type: "correction", nouvelleQuantite: 18, motif: "Inventaire du soir" });
  assert.equal(r.statut, 201);
  assert.equal(r.corps.mouvement.stockAvant, 20);
  assert.equal(r.corps.mouvement.stockApres, 18);
  assert.equal(await magasin.stock("restaurant", "r-modelo"), 18);
  assert.equal(magasin._mouvements.length, depart + 1, "un mouvement de plus, rien d'effacé");
});

test("panne à la validation : mouvement marqué Échec, stock inchangé, aucune confirmation", async () => {
  const { ops, magasin } = nouveau();
  magasin.pannes.valider = true;
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: "r-pisco", type: "sortie", quantite: 1 });
  assert.equal(r.statut, 502);
  assert.equal(await magasin.stock("restaurant", "r-pisco"), 5);
  assert.equal(magasin._mouvements.at(-1).statut, "Échec");
});

test("panne à la relecture : pas de confirmation", async () => {
  const { ops, magasin } = nouveau();
  magasin.pannes.relire = true;
  const r = await ops.enregistrer({ cle: cle(), activite: "restaurant", produitId: "r-pisco", type: "sortie", quantite: 1 });
  assert.equal(r.statut, 502);
});

test("alertes et contrôle", async () => {
  const { ops, magasin } = nouveau();
  const a = await ops.alertes();
  assert.deepEqual(a.corps.restaurant.ruptures.map((p) => p.id), ["r-cusq"]);
  assert.deepEqual(a.corps.restaurant.faibles.map((p) => p.id).sort(), ["r-modelo"]);
  assert.deepEqual(a.corps.epicerie.faibles.map((p) => p.id), ["e-pan"]);
  const c1 = await ops.controle();
  assert.equal(c1.corps.ok, true);
  magasin._mouvements.push({ id: "x", numero: 999, titre: "Sortie – Pisco – 1", activite: "restaurant", produitId: "r-pisco", type: "sortie", quantite: 1, date: "2026-01-01T00:00:00Z", statut: "En cours" });
  const c2 = await ops.controle();
  assert.equal(c2.corps.ok, false);
  assert.match(c2.corps.problemes[0].message, /En cours/);
});
