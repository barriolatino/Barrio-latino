// Gestionnaire HTTP de l'API (signature Node req/res, la même que Vercel).

import { traiter } from "../public/js/core/routes.js";
import { codeCorrect, cookieFin, cookieSession, creerFrein, creerSession, lireSession } from "./acces.js";

const TAILLE_MAX = 10_000;

function envoyer(res, statut, corps, entetes = {}) {
  res.statusCode = statut;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  for (const [k, v] of Object.entries(entetes)) res.setHeader(k, v);
  res.end(JSON.stringify(corps));
}

async function lireCorps(req) {
  if (req.body !== undefined) {
    // Vercel a déjà lu le corps.
    return typeof req.body === "string" ? JSON.parse(req.body || "null") : req.body;
  }
  let texte = "";
  for await (const morceau of req) {
    texte += morceau;
    if (texte.length > TAILLE_MAX) throw new Error("trop gros");
  }
  return texte ? JSON.parse(texte) : null;
}

export function creerGestionnaireApi({ ops, config, securise = true, maintenant = () => new Date() }) {
  const frein = creerFrein();

  return async function gestionnaire(req, res) {
    const url = new URL(req.url, "http://local");
    const chemin = url.pathname;
    const methode = req.method;
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();

    // Protection contre les envois depuis un autre site : en-tête maison obligatoire.
    if (methode !== "GET" && req.headers["x-mon-stock"] !== "1") {
      return envoyer(res, 403, { erreur: { code: "INTERDIT", message: "Requête refusée." } });
    }

    let corps = null;
    if (methode === "POST") {
      try {
        corps = await lireCorps(req);
      } catch {
        return envoyer(res, 400, { erreur: { code: "CORPS_INVALIDE", message: "Requête illisible." } });
      }
    }

    if (chemin === "/api/connexion" && methode === "POST") {
      if (frein.bloque(ip)) {
        return envoyer(res, 429, { erreur: { code: "TROP_D_ESSAIS", message: "Trop d'essais. Attendez une minute." } });
      }
      if (!codeCorrect(corps?.code, config)) {
        frein.echec(ip);
        return envoyer(res, 401, { erreur: { code: "CODE_INCORRECT", message: "Code incorrect." } });
      }
      frein.reussite(ip);
      return envoyer(res, 200, { connecte: true }, { "Set-Cookie": cookieSession(creerSession(config), { securise }) });
    }
    if (chemin === "/api/deconnexion" && methode === "POST") {
      return envoyer(res, 200, { connecte: false }, { "Set-Cookie": cookieFin({ securise }) });
    }

    const session = lireSession(req.headers.cookie, config);
    if (chemin === "/api/session") return envoyer(res, 200, { connecte: Boolean(session) });
    if (!session) {
      return envoyer(res, 401, { erreur: { code: "NON_CONNECTE", message: "Entrez votre code d'accès." } });
    }

    const query = Object.fromEntries(url.searchParams);
    const r = await traiter({ methode, chemin, query, corps }, ops, { maintenant, utilisateur: session.utilisateur });
    return envoyer(res, r.statut, r.corps);
  };
}
