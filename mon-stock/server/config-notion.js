// Identifiants des bases Notion de GESTION DES STOCKS.
// Ce ne sont pas des secrets : sans la clé de l'intégration (variable NOTION_TOKEN),
// ils ne donnent accès à rien.

export const BASES = {
  restaurant: "41c46841-205f-814f-94a7-000b3b69d105", // STOCK RESTAURANT – BARRIO LATINO
  epicerie: "41c46841-205f-819c-ac61-000b9e067240", // STOCK ÉPICERIE
  historique: "41c46841-205f-8125-ae4c-000be3de819e", // HISTORIQUE DES MOUVEMENTS
};

/** Noms exacts des propriétés Notion (une faute de frappe ici = une colonne vide). */
export const P = {
  produit: {
    nom: "Nom du produit",
    categorie: "Catégorie",
    unite: "Unité de mesure",
    stockMinimum: "Stock minimum",
    fournisseur: "Fournisseur",
    archive: "Archivé",
    quantite: "Quantité disponible",
    mouvements: "Mouvements",
    prixAchat: { restaurant: "Prix d'achat unitaire", epicerie: "Prix d'achat" },
    prixVente: "Prix de vente",
    reference: "Référence",
  },
  mouvement: {
    titre: "Mouvement",
    numero: "N°",
    activite: "Activité",
    produit: { restaurant: "Produit restaurant", epicerie: "Produit épicerie" },
    type: "Type",
    quantite: "Quantité",
    stockAvant: "Stock avant",
    stockApres: "Stock après",
    date: "Date et heure",
    motif: "Motif",
    utilisateur: "Utilisateur",
    statut: "Statut",
    cle: "Clé d'opération",
    controle: "Contrôle",
  },
};

export const ACTIVITE_NOTION = { restaurant: "Restaurant", epicerie: "Épicerie" };
export const TYPE_NOTION = { entree: "Entrée", sortie: "Sortie", correction: "Correction" };
