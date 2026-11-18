// Point d'entrée Netlify : toutes les adresses /api/* passent par ici.
import { gestionnaireProduction } from "../../server/production.js";

export default async (requete, contexte) => {
  try {
    return await gestionnaireProduction()(requete, { ip: contexte?.ip || "?" });
  } catch {
    // Configuration manquante (clé Notion, code d'accès) : on ne révèle rien.
    return new Response(JSON.stringify({ erreur: { code: "CONFIGURATION", message: "Service non configuré." } }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
};

export const config = { path: "/api/*" };
