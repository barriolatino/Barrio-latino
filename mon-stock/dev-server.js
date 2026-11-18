// Serveur d'essai local : l'application + l'API sur des données fictives en mémoire.
// Jamais relié à Notion. Lancement : npm run dev  →  http://localhost:8787  (code : 2468)

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { creerMagasinMemoire } from "./public/js/core/magasin-memoire.js";
import { creerOperations } from "./public/js/core/operations.js";
import { configAcces } from "./server/acces.js";
import { creerGestionnaireApi } from "./server/http.js";

const RACINE = fileURLToPath(new URL("./public/", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

export function demarrer({ port = Number(process.env.PORT) || 8787 } = {}) {
  const config = configAcces({
    MON_STOCK_CODE: process.env.MON_STOCK_CODE || "2468",
    MON_STOCK_SECRET: process.env.MON_STOCK_SECRET || "essai-local-uniquement-0123456789abcdef",
  });
  let magasin = creerMagasinMemoire();
  let api = creerGestionnaireApi({ ops: creerOperations(magasin), config, securise: false });

  const serveur = createServer(async (req, res) => {
    const url = new URL(req.url, "http://local");

    // Commandes réservées aux essais automatiques.
    if (url.pathname.startsWith("/__essai/")) {
      const action = url.pathname.slice(9);
      if (action === "reinitialiser") {
        magasin = creerMagasinMemoire();
        api = creerGestionnaireApi({ ops: creerOperations(magasin), config, securise: false });
      } else if (action.startsWith("panne/")) {
        magasin.pannes[action.slice(6)] = true;
      } else if (action === "lenteur") {
        const ms = Number(url.searchParams.get("ms")) || 0;
        for (const nom of ["creerMouvement"]) {
          const original = magasin[nom];
          magasin[nom] = async (...a) => {
            await new Promise((r) => setTimeout(r, ms));
            return original(...a);
          };
        }
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ mouvements: magasin._mouvements }));
    }

    if (url.pathname.startsWith("/api/")) return api(req, res);

    let chemin = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (chemin.endsWith("/")) chemin += "index.html";
    try {
      const contenu = await readFile(join(RACINE, chemin));
      res.setHeader("Content-Type", TYPES[extname(chemin)] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.end(contenu);
    } catch {
      res.statusCode = 404;
      res.end("Introuvable");
    }
  });

  return new Promise((ok) => serveur.listen(port, () => ok(serveur)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await demarrer();
  console.log(`MON STOCK (essai, données fictives) : http://localhost:${s.address().port}  — code 2468`);
}
