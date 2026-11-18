// Assemblage de production : Notion + code d'accès, lus dans les variables d'environnement.
import { creerOperations } from "../public/js/core/operations.js";
import { configAcces } from "./acces.js";
import { creerGestionnaireApi } from "./http.js";
import { creerMagasinNotion } from "./magasin-notion.js";

let gestionnaire = null;

export function gestionnaireProduction({ env = process.env, fetch } = {}) {
  if (!gestionnaire) {
    const magasin = creerMagasinNotion({ jeton: env.NOTION_TOKEN, ...(fetch ? { fetch } : {}) });
    gestionnaire = creerGestionnaireApi({ ops: creerOperations(magasin), config: configAcces(env), securise: true });
  }
  return gestionnaire;
}

export function _reinitialiser() {
  gestionnaire = null;
}
