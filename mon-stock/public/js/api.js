// Accès à l'API. En production : le serveur Vercel (qui seul parle à Notion).
// En démonstration : les mêmes opérations, exécutées dans le navigateur sur des données fictives.

export const MODE_DEMO = document.documentElement.dataset.mode === "demo";

export class ErreurReseau extends Error {
  constructor(message = "Pas de réponse du serveur.") {
    super(message);
    this.reseau = true;
  }
}

let demo = null;
async function moteurDemo() {
  if (!demo) {
    const [{ creerMagasinMemoire }, { creerOperations }, { traiter }] = await Promise.all([
      import("./core/magasin-memoire.js"),
      import("./core/operations.js"),
      import("./core/routes.js"),
    ]);
    const ops = creerOperations(creerMagasinMemoire({ debut: new Date(Date.now() - 3 * 3600_000) }));
    demo = (requete) => traiter(requete, ops, { utilisateur: "Clément" });
  }
  return demo;
}

/** Renvoie { statut, corps }. Lève ErreurReseau si la réponse n'arrive pas. */
export async function appel(methode, chemin, { query, corps, delaiMs = 20_000 } = {}) {
  if (MODE_DEMO) {
    if (!navigator.onLine) throw new ErreurReseau("Pas de connexion.");
    if (chemin === "/api/session") return { statut: 200, corps: { connecte: true } };
    const executer = await moteurDemo();
    await new Promise((r) => setTimeout(r, methode === "POST" ? 650 : 180));
    if (!navigator.onLine) throw new ErreurReseau("Connexion perdue pendant l'envoi.");
    return executer({ methode, chemin, query: query || {}, corps: corps ? structuredClone(corps) : null });
  }

  const url = new URL(chemin, location.origin);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);

  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), delaiMs);
  let reponse;
  try {
    reponse = await fetch(url, {
      method: methode,
      credentials: "same-origin",
      cache: "no-store",
      headers: methode === "GET" ? {} : { "Content-Type": "application/json", "X-Mon-Stock": "1" },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: controle.signal,
    });
  } catch {
    throw new ErreurReseau(controle.signal.aborted ? "Le serveur n'a pas répondu à temps." : "Pas de connexion au serveur.");
  } finally {
    clearTimeout(minuterie);
  }
  let donnees = null;
  try {
    donnees = await reponse.json();
  } catch {
    donnees = { erreur: { code: "REPONSE_ILLISIBLE", message: "Réponse du serveur illisible." } };
  }
  return { statut: reponse.status, corps: donnees };
}
