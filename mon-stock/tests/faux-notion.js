// Imitation de l'API Notion (sous-ensemble utilisé par MON STOCK) pour les essais.
// Reproduit : bases séparées, relation double sens, formules « Effet sur le stock » et
// « Contrôle », cumul « Quantité disponible », limite de 25 relations dans les pages,
// pagination, numérotation MVT, limite de débit (429) et pannes.

import { BASES, P } from "../server/config-notion.js";

let compteurId = 0;
const nouvelId = () => `00000000-0000-4000-8000-${String(++compteurId).padStart(12, "0")}`;
const sans = (id) => String(id).replace(/-/g, "");

const TYPES_PRODUIT = {
  [P.produit.nom]: "title",
  [P.produit.categorie]: "select",
  [P.produit.unite]: "select",
  [P.produit.stockMinimum]: "number",
  [P.produit.fournisseur]: "select",
  [P.produit.archive]: "checkbox",
  "Prix d'achat unitaire": "number",
  "Prix d'achat": "number",
  [P.produit.prixVente]: "number",
  [P.produit.reference]: "rich_text",
};
const TYPES_MOUVEMENT = {
  [P.mouvement.titre]: "title",
  [P.mouvement.activite]: "select",
  [P.mouvement.produit.restaurant]: "relation",
  [P.mouvement.produit.epicerie]: "relation",
  [P.mouvement.type]: "select",
  [P.mouvement.quantite]: "number",
  [P.mouvement.stockAvant]: "number",
  [P.mouvement.stockApres]: "number",
  [P.mouvement.date]: "date",
  [P.mouvement.motif]: "rich_text",
  [P.mouvement.utilisateur]: "select",
  [P.mouvement.statut]: "select",
  [P.mouvement.cle]: "rich_text",
};

function lireValeur(type, v) {
  if (type === "title" || type === "rich_text") return (v[type] || []).map((t) => t.text?.content ?? t.plain_text ?? "").join("");
  if (type === "select") return v.select?.name ?? null;
  if (type === "number") return v.number ?? null;
  if (type === "checkbox") return Boolean(v.checkbox);
  if (type === "date") return v.date?.start ?? null;
  if (type === "relation") return (v.relation || []).map((r) => r.id);
  throw new Error(`type ${type}`);
}

export function creerFauxNotion({ jeton = "secret-essai" } = {}) {
  const pages = new Map(); // id sans tirets → { id, base, valeurs, cree }
  let numero = 0;
  const pannes = []; // [{ quand: (methode, chemin) => bool, statut, fois }]
  const journal = [];
  let decalageRollup = 0;

  const typesDe = (base) => (base === BASES.historique ? TYPES_MOUVEMENT : TYPES_PRODUIT);

  function effet(m) {
    const v = m.valeurs;
    if (v[P.mouvement.statut] !== "Validé") return 0;
    const q = v[P.mouvement.quantite] ?? 0;
    if (v[P.mouvement.type] === "Entrée") return q;
    if (v[P.mouvement.type] === "Sortie") return -q;
    if (v[P.mouvement.type] === "Correction") return (v[P.mouvement.stockApres] ?? 0) - (v[P.mouvement.stockAvant] ?? 0);
    return 0;
  }
  function controle(m) {
    const v = m.valeurs;
    const r = v[P.mouvement.produit.restaurant] || [];
    const e = v[P.mouvement.produit.epicerie] || [];
    const ok =
      (v[P.mouvement.activite] === "Restaurant" && r.length === 1 && e.length === 0) ||
      (v[P.mouvement.activite] === "Épicerie" && e.length === 1 && r.length === 0);
    return ok ? "✅ OK" : "⚠️ À vérifier";
  }
  const mouvementsDe = (produitId) =>
    [...pages.values()].filter(
      (m) =>
        m.base === BASES.historique &&
        [...(m.valeurs[P.mouvement.produit.restaurant] || []), ...(m.valeurs[P.mouvement.produit.epicerie] || [])].some((id) => sans(id) === sans(produitId)),
    );
  const cumul = (produitId) => mouvementsDe(produitId).reduce((t, m) => t + effet(m), 0) + decalageRollup;

  /** Valeurs calculées comme Notion, y compris l'erreur au-delà de 25 relations dans un objet page. */
  function valeursCompletes(page, { tronquer = true } = {}) {
    const v = { ...page.valeurs };
    if (page.base === BASES.historique) {
      v[P.mouvement.numero] = page.numero;
      v["Effet sur le stock"] = effet(page);
      v[P.mouvement.controle] = controle(page);
    } else {
      const ms = mouvementsDe(page.id).sort((a, b) => a.cree - b.cree);
      const vus = tronquer ? ms.slice(0, 25) : ms;
      v[P.produit.mouvements] = { ids: vus.map((m) => m.id), has_more: ms.length > 25 };
      v[P.produit.quantite] = vus.reduce((t, m) => t + effet(m), 0) + decalageRollup;
    }
    return v;
  }

  function versApi(page) {
    const v = valeursCompletes(page);
    const types = typesDe(page.base);
    const proprietes = {};
    for (const [nom, type] of Object.entries(types)) {
      const x = v[nom];
      const base = { id: `id-${sans(nom).length}-${nom.length}`, type };
      if (type === "title" || type === "rich_text") proprietes[nom] = { ...base, [type]: x ? [{ plain_text: x, text: { content: x } }] : [] };
      else if (type === "select") proprietes[nom] = { ...base, select: x ? { name: x } : null };
      else if (type === "relation") proprietes[nom] = { ...base, relation: (x || []).map((id) => ({ id })), has_more: false };
      else if (type === "date") proprietes[nom] = { ...base, date: x ? { start: x } : null };
      else proprietes[nom] = { ...base, [type]: x ?? (type === "checkbox" ? false : null) };
    }
    if (page.base === BASES.historique) {
      proprietes[P.mouvement.numero] = { id: "num", type: "unique_id", unique_id: { prefix: "MVT", number: page.numero } };
      proprietes["Effet sur le stock"] = { id: "eff", type: "formula", formula: { type: "number", number: v["Effet sur le stock"] } };
      proprietes[P.mouvement.controle] = { id: "ctl", type: "formula", formula: { type: "string", string: v[P.mouvement.controle] } };
    } else {
      proprietes[P.produit.mouvements] = { id: "mvts", type: "relation", relation: v[P.produit.mouvements].ids.map((id) => ({ id })), has_more: v[P.produit.mouvements].has_more };
      proprietes[P.produit.quantite] = { id: "qte%3A", type: "rollup", rollup: { type: "number", number: v[P.produit.quantite], function: "sum" } };
    }
    return {
      object: "page",
      id: page.id,
      created_time: new Date(page.cree).toISOString(),
      archived: false,
      in_trash: false,
      parent: { type: "data_source_id", data_source_id: page.base, database_id: "db-" + page.base },
      properties: proprietes,
    };
  }

  function evaluer(filtre, page) {
    if (!filtre) return true;
    if (filtre.and) return filtre.and.every((f) => evaluer(f, page));
    if (filtre.or) return filtre.or.some((f) => evaluer(f, page));
    const v = valeursCompletes(page, { tronquer: false })[filtre.property];
    if (filtre.select) return v === filtre.select.equals;
    if (filtre.relation) return (v || []).some((id) => sans(id) === sans(filtre.relation.contains));
    if (filtre.rich_text) return (v ?? "") === filtre.rich_text.equals;
    if (filtre.title) return String(v ?? "").toLowerCase().includes(filtre.title.contains.toLowerCase());
    if (filtre.checkbox) return Boolean(v) === filtre.checkbox.equals;
    if (filtre.date) {
      if (!v) return false;
      if (filtre.date.on_or_after) return v >= filtre.date.on_or_after;
      if (filtre.date.before) return v < filtre.date.before;
    }
    if (filtre.formula?.string) return String(v ?? "").includes(filtre.formula.string.contains);
    throw new Error(`filtre non géré : ${JSON.stringify(filtre)}`);
  }

  const reponse = (statut, corps, entetes = {}) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json", ...entetes } });

  function creerPage(base, proprietes) {
    const types = typesDe(base);
    const valeurs = {};
    for (const [nom, val] of Object.entries(proprietes)) {
      if (!types[nom]) throw Object.assign(new Error(`propriété inconnue : ${nom}`), { statut: 400 });
      valeurs[nom] = lireValeur(types[nom], val);
    }
    const page = { id: nouvelId(), base, valeurs, cree: Date.now() + compteurId };
    if (base === BASES.historique) page.numero = ++numero;
    pages.set(sans(page.id), page);
    return page;
  }

  async function fetch(url, init = {}) {
    const methode = init.method || "GET";
    const chemin = new URL(url).pathname.replace("/v1", "");
    const corps = init.body ? JSON.parse(init.body) : null;
    journal.push({ methode, chemin, corps, entetes: init.headers });

    if (init.headers?.Authorization !== `Bearer ${jeton}`) return reponse(401, { code: "unauthorized", message: "API token is invalid." });
    if (!init.headers?.["Notion-Version"]) return reponse(400, { code: "missing_version" });

    const panne = pannes.find((p) => p.fois > 0 && p.quand(methode, chemin, corps));
    if (panne) {
      panne.fois--;
      if (panne.statut === "reseau") throw new TypeError("fetch failed");
      return reponse(panne.statut, { code: "panne", message: "panne simulée" }, panne.statut === 429 ? { "Retry-After": "0" } : {});
    }

    let m;
    if ((m = chemin.match(/^\/data_sources\/([^/]+)\/query$/)) && methode === "POST") {
      const base = m[1];
      let liste = [...pages.values()].filter((p) => p.base === base && evaluer(corps.filter, p));
      if (corps.sorts?.[0]?.property === P.mouvement.date) {
        liste.sort((a, b) => (a.valeurs[P.mouvement.date] < b.valeurs[P.mouvement.date] ? 1 : -1));
      }
      const debut = Number(corps.start_cursor || 0);
      const taille = corps.page_size || 100;
      const tranche = liste.slice(debut, debut + taille);
      const suite = debut + taille < liste.length;
      return reponse(200, { object: "list", results: tranche.map(versApi), has_more: suite, next_cursor: suite ? String(debut + taille) : null });
    }
    if (chemin === "/pages" && methode === "POST") {
      try {
        return reponse(200, versApi(creerPage(corps.parent.data_source_id, corps.properties)));
      } catch (e) {
        return reponse(e.statut || 500, { code: "validation_error", message: e.message });
      }
    }
    if ((m = chemin.match(/^\/pages\/([^/]+)\/properties\/([^/]+)$/)) && methode === "GET") {
      const page = pages.get(sans(m[1]));
      if (!page) return reponse(404, { code: "object_not_found" });
      return reponse(200, { object: "list", results: [], has_more: false, next_cursor: null, property_item: { type: "rollup", rollup: { type: "number", number: cumul(page.id) } } });
    }
    if ((m = chemin.match(/^\/pages\/([^/]+)$/))) {
      const page = pages.get(sans(decodeURIComponent(m[1])));
      if (!page) return reponse(404, { code: "object_not_found", message: "Could not find page." });
      if (methode === "PATCH") {
        const types = typesDe(page.base);
        for (const [nom, val] of Object.entries(corps.properties)) page.valeurs[nom] = lireValeur(types[nom], val);
      }
      return reponse(200, versApi(page));
    }
    return reponse(400, { code: "invalid_request_url" });
  }

  return {
    fetch,
    jeton,
    pages,
    journal,
    panne(quand, statut, fois = 1) {
      pannes.push({ quand, statut, fois });
    },
    fausserRollup(n) {
      decalageRollup = n;
    },
    ajouterProduit(activite, { nom, unite = "bouteille", stockMinimum = null, categorie = null, prixVente }) {
      const props = {
        [P.produit.nom]: { title: [{ text: { content: nom } }] },
        [P.produit.unite]: { select: { name: unite } },
        [P.produit.stockMinimum]: { number: stockMinimum },
        ...(categorie ? { [P.produit.categorie]: { select: { name: categorie } } } : {}),
        ...(prixVente !== undefined ? { [P.produit.prixVente]: { number: prixVente } } : {}),
      };
      return creerPage(BASES[activite], props).id;
    },
    ajouterMouvement(activite, produitId, { type = "Entrée", quantite, statut = "Validé", cle = `init-${compteurId}`, avant = 0, apres = 0, activiteNotion }) {
      return creerPage(BASES.historique, {
        [P.mouvement.titre]: { title: [{ text: { content: `${type} – essai – ${quantite}` } }] },
        [P.mouvement.activite]: { select: { name: activiteNotion || (activite === "restaurant" ? "Restaurant" : "Épicerie") } },
        [P.mouvement.produit[activite]]: { relation: [{ id: produitId }] },
        [P.mouvement.type]: { select: { name: type } },
        [P.mouvement.quantite]: { number: quantite },
        [P.mouvement.stockAvant]: { number: avant },
        [P.mouvement.stockApres]: { number: apres },
        [P.mouvement.date]: { date: { start: new Date(Date.now() - 3600_000).toISOString() } },
        [P.mouvement.statut]: { select: { name: statut } },
        [P.mouvement.cle]: { rich_text: [{ text: { content: cle } }] },
      }).id;
    },
    mouvements: () => [...pages.values()].filter((p) => p.base === BASES.historique),
  };
}
