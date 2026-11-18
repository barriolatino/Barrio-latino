// Magasin en mémoire : sert aux essais et au mode démonstration.
// Il imite Notion (deux bases de produits séparées, un historique commun)
// sans jamais s'y connecter. Les données sont fictives.

import { arrondi, effetMouvement, normaliser } from "./regles.js";

const PRODUITS_DEMO = {
  restaurant: [
    { id: "r-club", nom: "Cerveza Club Colombia", categorie: "Alcools", unite: "bouteille", stockMinimum: 24, initial: 48 },
    { id: "r-modelo", nom: "Cerveza Modelo", categorie: "Alcools", unite: "bouteille", stockMinimum: 24, initial: 20 },
    { id: "r-cusq", nom: "Cerveza Cusqueña rubia", categorie: "Alcools", unite: "bouteille", stockMinimum: 12, initial: 0 },
    { id: "r-pisco", nom: "Pisco", categorie: "Alcools", unite: "bouteille", stockMinimum: 2, initial: 5 },
    { id: "r-inca", nom: "Inca Kola", categorie: "Boissons", unite: "bouteille", stockMinimum: 12, initial: 30 },
    { id: "r-tajin", nom: "Tajín", categorie: "Épicerie", unite: "unité", stockMinimum: 1, initial: 3 },
    { id: "r-harina", nom: "Harina P.A.N. amarilla", categorie: "Épicerie", unite: "kg", stockMinimum: 5, initial: 12.5 },
  ],
  epicerie: [
    { id: "e-tajin", nom: "Tajín", categorie: "Sauces & épices", unite: "flacon", stockMinimum: 4, initial: 10, prixVente: 6 },
    { id: "e-pisco", nom: "Pisco Acholado", categorie: "Alcools", unite: "bouteille", stockMinimum: 2, initial: 6, prixVente: 22 },
    { id: "e-pan", nom: "Harina P.A.N. blanche", categorie: "Farines & maïs", unite: "paquet", stockMinimum: 6, initial: 5, prixVente: 4 },
    { id: "e-mate", nom: "Yerba maté Mañanita", categorie: "Cafés & maté", unite: "paquet", stockMinimum: 3, initial: 0, prixVente: 10 },
    { id: "e-cafe", nom: "Café moulu Cumbre", categorie: "Cafés & maté", unite: "paquet", stockMinimum: 3, initial: 8, prixVente: 15 },
  ],
};

export function creerMagasinMemoire({ produits = PRODUITS_DEMO, debut = new Date("2026-11-18T09:00:00+01:00") } = {}) {
  const bases = {};
  const mouvements = [];
  let numero = 0;
  let id = 0;
  /** Pannes simulées : { creer, valider, lire, relire } → true = la prochaine échoue, un nombre n = les n prochaines. */
  const pannes = {};

  for (const [activite, liste] of Object.entries(produits)) {
    bases[activite] = new Map();
    for (const { initial, ...p } of liste) {
      bases[activite].set(p.id, { archive: false, fournisseur: null, ...p });
      if (initial) {
        mouvements.push({
          id: `m${++id}`,
          numero: ++numero,
          titre: `Entrée – ${p.nom} – inventaire initial`,
          cle: `demo-initial-${p.id}`,
          activite,
          produitId: p.id,
          produitNom: p.nom,
          unite: p.unite,
          type: "entree",
          quantite: initial,
          stockAvant: 0,
          stockApres: initial,
          motif: "Inventaire initial",
          utilisateur: "Clément",
          date: debut.toISOString(),
          statut: "Validé",
        });
      }
    }
  }

  const copie = (o) => (o ? structuredClone(o) : o);
  const panne = (nom) => {
    if (pannes[nom]) {
      pannes[nom] = typeof pannes[nom] === "number" ? pannes[nom] - 1 : false;
      throw new Error(`panne simulée : ${nom}`);
    }
  };

  return {
    pannes,
    delaiRelectureMs: 0,
    _mouvements: mouvements,

    async produits(activite) {
      panne("lire");
      return [...(bases[activite]?.values() || [])].map(copie);
    },
    async produit(activite, produitId) {
      panne("lire");
      return copie(bases[activite]?.get(produitId)) || null;
    },
    async stock(activite, produitId) {
      return arrondi(
        mouvements
          .filter((m) => m.activite === activite && m.produitId === produitId)
          .reduce((total, m) => total + effetMouvement(m), 0),
      );
    },
    async mouvement(mouvementId) {
      panne("relire");
      return copie(mouvements.find((m) => m.id === mouvementId)) || null;
    },
    async mouvementsParCle(cle) {
      return mouvements.filter((m) => m.cle === cle).map(copie);
    },
    async mouvements({ activite, type, produitId, depuis, jusqua, statuts, recherche, limite = 100 } = {}) {
      const r = normaliser(recherche);
      return mouvements
        .filter(
          (m) =>
            (!activite || m.activite === activite) &&
            (!type || m.type === type) &&
            (!produitId || m.produitId === produitId) &&
            (!depuis || m.date >= depuis) &&
            (!jusqua || m.date < jusqua) &&
            (!statuts || statuts.includes(m.statut)) &&
            (!r || normaliser(m.produitNom).includes(r)),
        )
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.numero - a.numero))
        .slice(0, limite)
        .map(copie);
    },
    async creerMouvement(donnees) {
      panne("creer");
      const produit = bases[donnees.activite]?.get(donnees.produitId);
      const m = { ...donnees, id: `m${++id}`, numero: ++numero, produitNom: produit?.nom || "?", unite: produit?.unite || null };
      mouvements.push(m);
      return copie(m);
    },
    async changerStatut(mouvementId, statut) {
      if (statut === "Validé") panne("valider");
      const m = mouvements.find((x) => x.id === mouvementId);
      if (!m) throw new Error("mouvement introuvable");
      m.statut = statut;
      return copie(m);
    },
  };
}
