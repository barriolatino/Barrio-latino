// Règles métier de MON STOCK, partagées par le serveur et l'application.
// Aucune dépendance : ce fichier tourne dans Node comme dans le navigateur.

export const ACTIVITES = {
  restaurant: { nom: "Barrio Latino", court: "Restaurant", notion: "Restaurant" },
  epicerie: { nom: "Épicerie", court: "Épicerie", notion: "Épicerie" },
};

export const TYPES = {
  entree: { nom: "Entrée", notion: "Entrée" },
  sortie: { nom: "Sortie", notion: "Sortie" },
  correction: { nom: "Correction", notion: "Correction" },
};

export const STATUTS_MOUVEMENT = ["En cours", "Validé", "Échec", "Annulé"];

/** Arrondi à 3 décimales : évite 0,1 + 0,2 = 0,30000000000000004 (les kg, les litres). */
export function arrondi(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

/** Même règle que la formule « Statut du stock » de Notion. */
export function statutStock(quantite, stockMinimum) {
  if (quantite <= 0) return "rupture";
  if (stockMinimum !== null && stockMinimum !== undefined && quantite <= stockMinimum) return "faible";
  return "ok";
}

/** Effet d'un mouvement sur le stock : même règle que la formule « Effet sur le stock ». */
export function effetMouvement(m) {
  if (m.statut !== "Validé") return 0;
  if (m.type === "entree") return m.quantite;
  if (m.type === "sortie") return -m.quantite;
  if (m.type === "correction") return arrondi(m.stockApres - m.stockAvant);
  return 0;
}

export class ErreurMetier extends Error {
  constructor(code, message, statut = 422, details = {}) {
    super(message);
    this.code = code;
    this.statut = statut;
    this.details = details;
  }
}

function lireNombre(valeur, champ) {
  if (valeur === "" || valeur === null || valeur === undefined) {
    throw new ErreurMetier("QUANTITE_MANQUANTE", `Indiquez ${champ}.`);
  }
  const n = typeof valeur === "string" ? Number(valeur.replace(",", ".").trim()) : Number(valeur);
  if (!Number.isFinite(n)) throw new ErreurMetier("QUANTITE_INVALIDE", `${champ[0].toUpperCase()}${champ.slice(1)} n'est pas un nombre.`);
  if (n < 0) throw new ErreurMetier("QUANTITE_NEGATIVE", "Une quantité ne peut pas être négative.");
  if (n > 1_000_000) throw new ErreurMetier("QUANTITE_TROP_GRANDE", "Cette quantité paraît trop grande. Vérifiez la saisie.");
  return arrondi(n);
}

/**
 * Calcule l'opération sans rien enregistrer.
 * entree / sortie : `quantite` > 0. correction : `nouvelleQuantite` ≥ 0 et motif obligatoire.
 */
export function calculerOperation({ type, stock, quantite, nouvelleQuantite, motif }) {
  if (!TYPES[type]) throw new ErreurMetier("TYPE_INVALIDE", "Type de mouvement inconnu.");
  const avant = arrondi(stock);

  if (type === "correction") {
    const apres = lireNombre(nouvelleQuantite, "la quantité réelle comptée");
    if (!motif || !String(motif).trim()) {
      throw new ErreurMetier("MOTIF_OBLIGATOIRE", "Une correction demande un motif (inventaire, casse, erreur de saisie…).");
    }
    if (apres === avant) {
      throw new ErreurMetier("AUCUN_ECART", "La quantité comptée est égale au stock actuel : il n'y a rien à corriger.");
    }
    return { avant, apres, quantite: arrondi(Math.abs(apres - avant)), ecart: arrondi(apres - avant) };
  }

  const q = lireNombre(quantite, type === "entree" ? "la quantité reçue" : "la quantité à retirer");
  if (q === 0) throw new ErreurMetier("QUANTITE_NULLE", "La quantité doit être supérieure à zéro.");
  if (type === "sortie" && q > avant) {
    throw new ErreurMetier(
      "STOCK_INSUFFISANT",
      `Sortie impossible : il ne reste que ${formaterNombre(avant)} en stock.`,
      422,
      { stock: avant },
    );
  }
  const apres = arrondi(type === "entree" ? avant + q : avant - q);
  return { avant, apres, quantite: q, ecart: arrondi(apres - avant) };
}

export function formaterNombre(n) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);
}

const PLURIELS = new Set(["unité", "bouteille", "carton", "sachet", "boîte", "pack", "paquet", "bocal", "flacon", "pain", "pot", "canette", "brique", "fût"]);

/** « 12 bouteilles », « 1 bouteille », « 2,5 kg ». */
export function avecUnite(n, unite) {
  const nombre = formaterNombre(n);
  if (!unite) return nombre;
  let u = unite;
  if (Math.abs(n) >= 2 && PLURIELS.has(unite)) u = unite === "bocal" ? "bocaux" : `${unite}s`;
  return `${nombre} ${u}`;
}

/** Clé anti-doublon : 8 à 64 caractères sûrs. */
export function cleValide(cle) {
  return typeof cle === "string" && /^[A-Za-z0-9-]{8,64}$/.test(cle);
}

/** Texte normalisé pour la recherche : sans accents ni majuscules. */
export function normaliser(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
