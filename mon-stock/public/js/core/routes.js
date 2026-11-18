// Table des routes de l'API, commune au serveur et au mode démonstration.

const JOUR = 24 * 60 * 60 * 1000;

function periode(query, maintenant) {
  if (query.date) {
    // Une journée précise, heure de Paris approximée par l'heure locale du serveur.
    const debut = new Date(`${query.date}T00:00:00`);
    if (Number.isNaN(debut.getTime())) return {};
    return { depuis: debut.toISOString(), jusqua: new Date(debut.getTime() + JOUR).toISOString() };
  }
  const jours = { "1": 1, "7": 7, "30": 30 }[query.jours];
  if (!jours) return {};
  const debut = new Date(maintenant());
  debut.setHours(0, 0, 0, 0);
  return { depuis: new Date(debut.getTime() - (jours - 1) * JOUR).toISOString() };
}

export async function traiter({ methode, chemin, query = {}, corps = null }, ops, { maintenant = () => new Date(), utilisateur } = {}) {
  const segments = chemin.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [ressource, a, b] = segments;

  if (methode === "GET" && ressource === "produits" && !a) return ops.produits({ activite: query.activite });
  if (methode === "GET" && ressource === "produits" && a && b) return ops.produit({ activite: a, id: b });
  if (methode === "GET" && ressource === "alertes") return ops.alertes();
  if (methode === "GET" && ressource === "controle") return ops.controle();
  if (methode === "GET" && ressource === "mouvements") {
    return ops.mouvements({
      activite: query.activite || undefined,
      type: query.type || undefined,
      produitId: query.produit || undefined,
      recherche: query.recherche || undefined,
      limite: query.limite,
      ...periode(query, maintenant),
    });
  }
  if (methode === "POST" && ressource === "mouvements") return ops.enregistrer(corps, { utilisateur });

  return { statut: 404, corps: { erreur: { code: "INTROUVABLE", message: "Adresse inconnue." } } };
}
