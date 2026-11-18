// L'assemblage de production, branché sur l'imitation de Notion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerFauxNotion } from "./faux-notion.js";
import { gestionnaireProduction, _reinitialiser } from "../server/production.js";

test("production : code, session sécurisée, lecture Notion, clé jamais renvoyée", async () => {
  _reinitialiser();
  const notion = creerFauxNotion({ jeton: "cle-notion-essai" });
  notion.ajouterProduit("restaurant", { nom: "Pisco" });
  const env = { NOTION_TOKEN: "cle-notion-essai", MON_STOCK_CODE: "135790", MON_STOCK_SECRET: "x".repeat(40) };
  const api = gestionnaireProduction({ env, fetch: notion.fetch });
  const post = (chemin, corps, entetes = {}) =>
    api(new Request(`https://mon-stock.exemple${chemin}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Mon-Stock": "1", ...entetes }, body: JSON.stringify(corps) }));

  assert.equal((await post("/api/connexion", { code: "000000" })).status, 401);
  const ok = await post("/api/connexion", { code: "135790" });
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);

  const r = await api(new Request("https://mon-stock.exemple/api/produits?activite=restaurant", { headers: { cookie: cookie.split(";")[0] } }));
  const texte = await r.text();
  assert.equal(r.status, 200);
  assert.match(texte, /Pisco/);
  assert.doesNotMatch(texte, /cle-notion-essai/);
  _reinitialiser();
});
