// Gestionnaire de l'API au format standard du web (Request → Response).
// Le même code tourne sur Netlify, Vercel ou le serveur d'essai local.

import { traiter } from "../public/js/core/routes.js";
import { codeCorrect, cookieFin, cookieSession, creerFrein, creerSession, lireSession } from "./acces.js";

const TAILLE_MAX = 10_000;

function json(statut, corps, entetes = {}) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...entetes,
    },
  });
}

export function creerGestionnaireApi({ ops, config, securise = true, maintenant = () => new Date() }) {
  const frein = creerFrein();

  return async function gestionnaire(requete, { ip = "?" } = {}) {
    const url = new URL(requete.url);
    const chemin = url.pathname;
    const methode = requete.method;

    // Protection contre les envois depuis un autre site : en-tête maison obligatoire.
    if (methode !== "GET" && requete.headers.get("x-mon-stock") !== "1") {
      return json(403, { erreur: { code: "INTERDIT", message: "Requête refusée." } });
    }

    let corps = null;
    if (methode === "POST") {
      try {
        const texte = await requete.text();
        if (texte.length > TAILLE_MAX) throw new Error("trop gros");
        corps = texte ? JSON.parse(texte) : null;
      } catch {
        return json(400, { erreur: { code: "CORPS_INVALIDE", message: "Requête illisible." } });
      }
    }

    if (chemin === "/api/connexion" && methode === "POST") {
      if (frein.bloque(ip)) {
        return json(429, { erreur: { code: "TROP_D_ESSAIS", message: "Trop d'essais. Attendez une minute." } });
      }
      if (!codeCorrect(corps?.code, config)) {
        frein.echec(ip);
        return json(401, { erreur: { code: "CODE_INCORRECT", message: "Code incorrect." } });
      }
      frein.reussite(ip);
      return json(200, { connecte: true }, { "Set-Cookie": cookieSession(creerSession(config), { securise }) });
    }
    if (chemin === "/api/deconnexion" && methode === "POST") {
      return json(200, { connecte: false }, { "Set-Cookie": cookieFin({ securise }) });
    }

    const session = lireSession(requete.headers.get("cookie"), config);
    if (chemin === "/api/session") return json(200, { connecte: Boolean(session) });
    if (!session) return json(401, { erreur: { code: "NON_CONNECTE", message: "Entrez votre code d'accès." } });

    const query = Object.fromEntries(url.searchParams);
    const r = await traiter({ methode, chemin, query, corps }, ops, { maintenant, utilisateur: session.utilisateur });
    return json(r.statut, r.corps);
  };
}

/** Adaptateur pour un serveur Node classique (serveur d'essai local). */
export function versNode(gestionnaire) {
  return async (req, res) => {
    const morceaux = [];
    for await (const m of req) morceaux.push(m);
    const corps = morceaux.length ? Buffer.concat(morceaux) : undefined;
    const requete = new Request(`http://${req.headers.host || "local"}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : corps,
    });
    const reponse = await gestionnaire(requete, { ip: req.socket?.remoteAddress || "?" });
    res.statusCode = reponse.status;
    reponse.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await reponse.arrayBuffer()));
  };
}
