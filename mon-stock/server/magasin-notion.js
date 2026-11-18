// Magasin Notion : lit et écrit GESTION DES STOCKS par l'API officielle de Notion.
// Aucune bibliothèque : de simples appels HTTPS. La clé reste sur le serveur.

import { effetMouvement, arrondi } from "../public/js/core/regles.js";
import { ACTIVITE_NOTION, BASES, P, TYPE_NOTION } from "./config-notion.js";

const VERSION_API = "2025-09-03";
const inverse = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const ACTIVITE_APP = inverse(ACTIVITE_NOTION);
const TYPE_APP = inverse(TYPE_NOTION);

/* ---------- Lecture des propriétés ---------- */

const texte = (p) => (p?.title || p?.rich_text || []).map((t) => t.plain_text ?? t.text?.content ?? "").join("");
const choix = (p) => p?.select?.name ?? null;
const nombre = (p) => (typeof p?.number === "number" ? p.number : null);
const coche = (p) => Boolean(p?.checkbox);
const relationIds = (p) => (p?.relation || []).map((r) => r.id);
function valeurRollup(p) {
  const r = p?.rollup;
  if (!r) return null;
  if (r.type === "number") return r.number ?? 0;
  return null;
}

const sansTirets = (id) => String(id).replace(/-/g, "");
const memeId = (a, b) => sansTirets(a) === sansTirets(b);

export function creerMagasinNotion({ jeton, fetch: f = globalThis.fetch, bases = BASES, attente = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!jeton) throw new Error("NOTION_TOKEN manquant.");

  /* ---------- Appels HTTP ---------- */

  async function appel(methode, chemin, corps, { rejouable = methode === "GET" } = {}) {
    for (let essai = 0; ; essai++) {
      let r;
      try {
        r = await f(`https://api.notion.com/v1${chemin}`, {
          method: methode,
          headers: {
            Authorization: `Bearer ${jeton}`,
            "Notion-Version": VERSION_API,
            "Content-Type": "application/json",
          },
          body: corps ? JSON.stringify(corps) : undefined,
        });
      } catch (e) {
        if (rejouable && essai < 2) {
          await attente(400 * (essai + 1));
          continue;
        }
        throw e;
      }
      // Limite de débit de Notion (≈ 3 requêtes/s) : on attend et on recommence, même pour une écriture,
      // car une réponse 429 garantit que rien n'a été écrit.
      if (r.status === 429 && essai < 4) {
        await attente(Math.min(Number(r.headers.get("retry-after")) * 1000 || 1000, 5000));
        continue;
      }
      if (r.status >= 500 && rejouable && essai < 2) {
        await attente(500 * (essai + 1));
        continue;
      }
      const donnees = await r.json().catch(() => ({}));
      if (!r.ok) {
        const e = new Error(`Notion ${r.status} : ${donnees.code || ""} ${donnees.message || ""}`.trim());
        e.statut = r.status;
        throw e;
      }
      return donnees;
    }
  }

  /** Interroge une base, page après page. Une requête de lecture peut être rejouée sans risque. */
  async function interroger(base, { filtre, tris, limite = Infinity } = {}) {
    const resultats = [];
    let curseur;
    do {
      const r = await appel(
        "POST",
        `/data_sources/${base}/query`,
        {
          ...(filtre ? { filter: filtre } : {}),
          ...(tris ? { sorts: tris } : {}),
          page_size: Math.min(100, limite - resultats.length),
          ...(curseur ? { start_cursor: curseur } : {}),
        },
        { rejouable: true },
      );
      resultats.push(...r.results);
      curseur = r.has_more ? r.next_cursor : null;
    } while (curseur && resultats.length < limite);
    return resultats;
  }

  /* ---------- Conversion Notion → application ---------- */

  function versProduit(activite, page) {
    const p = page.properties;
    return {
      id: page.id,
      nom: texte(p[P.produit.nom]),
      categorie: choix(p[P.produit.categorie]),
      unite: choix(p[P.produit.unite]),
      stockMinimum: nombre(p[P.produit.stockMinimum]),
      fournisseur: choix(p[P.produit.fournisseur]),
      archive: coche(p[P.produit.archive]),
      prixAchat: nombre(p[P.produit.prixAchat[activite]]),
      prixVente: nombre(p[P.produit.prixVente]),
      reference: texte(p[P.produit.reference]) || null,
    };
  }

  let cacheProduits = { quand: 0, carte: new Map() };
  async function carteProduits() {
    if (Date.now() - cacheProduits.quand < 60_000) return cacheProduits.carte;
    const carte = new Map();
    for (const activite of ["restaurant", "epicerie"]) {
      for (const page of await interroger(bases[activite])) carte.set(sansTirets(page.id), versProduit(activite, page));
    }
    cacheProduits = { quand: Date.now(), carte };
    return carte;
  }

  async function versMouvement(page, carte) {
    const p = page.properties;
    const activite = ACTIVITE_APP[choix(p[P.mouvement.activite])] || null;
    const produitId = activite ? relationIds(p[P.mouvement.produit[activite]])[0] || null : null;
    const produit = produitId ? (carte || (await carteProduits())).get(sansTirets(produitId)) : null;
    return {
      id: page.id,
      numero: p[P.mouvement.numero]?.unique_id?.number ?? null,
      titre: texte(p[P.mouvement.titre]),
      cle: texte(p[P.mouvement.cle]),
      activite,
      produitId,
      produitNom: produit?.nom || texte(p[P.mouvement.titre]).split(" – ")[1] || "?",
      unite: produit?.unite || null,
      type: TYPE_APP[choix(p[P.mouvement.type])] || null,
      quantite: nombre(p[P.mouvement.quantite]) ?? 0,
      stockAvant: nombre(p[P.mouvement.stockAvant]) ?? 0,
      stockApres: nombre(p[P.mouvement.stockApres]) ?? 0,
      motif: texte(p[P.mouvement.motif]),
      utilisateur: choix(p[P.mouvement.utilisateur]),
      date: p[P.mouvement.date]?.date?.start || page.created_time,
      statut: choix(p[P.mouvement.statut]),
    };
  }

  const filtreProduit = (activite, produitId) => ({
    and: [
      { property: P.mouvement.activite, select: { equals: ACTIVITE_NOTION[activite] } },
      { property: P.mouvement.produit[activite], relation: { contains: produitId } },
    ],
  });

  /** Quantité affichée par Notion (rollup), lue exactement même au-delà de 25 mouvements. */
  async function rollupExact(page) {
    const prop = page.properties[P.produit.quantite];
    const relation = page.properties[P.produit.mouvements];
    if (!relation?.has_more) return valeurRollup(prop) ?? 0;
    let curseur;
    let derniere = null;
    do {
      const r = await appel("GET", `/pages/${page.id}/properties/${encodeURIComponent(prop.id)}${curseur ? `?start_cursor=${curseur}` : ""}`);
      derniere = r.property_item?.rollup ?? derniere;
      curseur = r.has_more ? r.next_cursor : null;
    } while (curseur);
    return derniere?.type === "number" ? derniere.number ?? 0 : 0;
  }

  /* ---------- Interface du magasin (la même que le magasin de démonstration) ---------- */

  return {
    async produits(activite) {
      return (await interroger(bases[activite])).map((page) => versProduit(activite, page));
    },

    /** Liste avec quantités en une requête (plus les produits ayant plus de 25 mouvements). */
    async produitsAvecStock(activite) {
      const pages = await interroger(bases[activite]);
      const liste = [];
      for (const page of pages) liste.push({ ...versProduit(activite, page), quantite: await rollupExact(page) });
      return liste;
    },

    async produit(activite, produitId) {
      let page;
      try {
        page = await appel("GET", `/pages/${encodeURIComponent(produitId)}`);
      } catch (e) {
        if (e.statut === 404 || e.statut === 400) return null;
        throw e;
      }
      // Séparation stricte : la page doit appartenir à la base de l'activité demandée.
      const parent = page.parent?.data_source_id || page.parent?.database_id;
      if (page.archived || page.in_trash || !parent || !memeId(parent, bases[activite])) return null;
      return versProduit(activite, page);
    },

    /** Stock exact = somme des mouvements validés du produit (indépendant du calcul de Notion). */
    async stock(activite, produitId) {
      const pages = await interroger(bases.historique, {
        filtre: { and: [...filtreProduit(activite, produitId).and, { property: P.mouvement.statut, select: { equals: "Validé" } }] },
      });
      const carte = new Map();
      let total = 0;
      for (const page of pages) total += effetMouvement(await versMouvement(page, carte));
      return arrondi(total);
    },

    /** Somme des mouvements validés de tous les produits, en une seule lecture paginée. */
    async stocksTous() {
      const pages = await interroger(bases.historique, { filtre: { property: P.mouvement.statut, select: { equals: "Validé" } } });
      const carte = new Map();
      const sommes = new Map();
      for (const page of pages) {
        const m = await versMouvement(page, carte);
        if (!m.activite || !m.produitId) continue;
        const cle = `${m.activite}:${sansTirets(m.produitId)}`;
        sommes.set(cle, arrondi((sommes.get(cle) || 0) + effetMouvement(m)));
      }
      // Les identifiants de produits peuvent arriver avec ou sans tirets.
      return { get: (cle) => sommes.get(cle.replace(/:(.*)$/, (_, id) => `:${sansTirets(id)}`)) };
    },

    async stockAffiche(activite, produitId) {
      try {
        return await rollupExact(await appel("GET", `/pages/${encodeURIComponent(produitId)}`));
      } catch {
        return null;
      }
    },

    async mouvement(mouvementId) {
      return versMouvement(await appel("GET", `/pages/${encodeURIComponent(mouvementId)}`));
    },

    async mouvementsParCle(cle) {
      const pages = await interroger(bases.historique, { filtre: { property: P.mouvement.cle, rich_text: { equals: cle } } });
      const carte = await carteProduits();
      return Promise.all(pages.map((p) => versMouvement(p, carte)));
    },

    async mouvements({ activite, type, produitId, depuis, jusqua, statuts, recherche, limite = 100 } = {}) {
      const et = [];
      if (activite) et.push({ property: P.mouvement.activite, select: { equals: ACTIVITE_NOTION[activite] } });
      if (activite && produitId) et.push({ property: P.mouvement.produit[activite], relation: { contains: produitId } });
      if (type) et.push({ property: P.mouvement.type, select: { equals: TYPE_NOTION[type] } });
      if (depuis) et.push({ property: P.mouvement.date, date: { on_or_after: depuis } });
      if (jusqua) et.push({ property: P.mouvement.date, date: { before: jusqua } });
      if (statuts?.length) et.push({ or: statuts.map((s) => ({ property: P.mouvement.statut, select: { equals: s } })) });
      if (recherche) et.push({ property: P.mouvement.titre, title: { contains: recherche } });
      const pages = await interroger(bases.historique, {
        filtre: et.length ? { and: et } : undefined,
        tris: [{ property: P.mouvement.date, direction: "descending" }],
        limite,
      });
      const carte = await carteProduits();
      return Promise.all(pages.map((p) => versMouvement(p, carte)));
    },

    async creerMouvement(m) {
      const page = await appel(
        "POST",
        "/pages",
        {
          parent: { type: "data_source_id", data_source_id: bases.historique },
          properties: {
            [P.mouvement.titre]: { title: [{ text: { content: m.titre.slice(0, 200) } }] },
            [P.mouvement.activite]: { select: { name: ACTIVITE_NOTION[m.activite] } },
            [P.mouvement.produit[m.activite]]: { relation: [{ id: m.produitId }] },
            [P.mouvement.type]: { select: { name: TYPE_NOTION[m.type] } },
            [P.mouvement.quantite]: { number: m.quantite },
            [P.mouvement.stockAvant]: { number: m.stockAvant },
            [P.mouvement.stockApres]: { number: m.stockApres },
            [P.mouvement.date]: { date: { start: m.date } },
            [P.mouvement.motif]: { rich_text: m.motif ? [{ text: { content: m.motif } }] : [] },
            [P.mouvement.utilisateur]: { select: { name: m.utilisateur || "Clément" } },
            [P.mouvement.statut]: { select: { name: m.statut } },
            [P.mouvement.cle]: { rich_text: [{ text: { content: m.cle } }] },
          },
        },
        { rejouable: false }, // jamais rejouée automatiquement : la clé d'opération gère les doublons
      );
      return versMouvement(page);
    },

    async changerStatut(mouvementId, statut) {
      // Rejouable : remettre le même statut deux fois ne change rien.
      const page = await appel(
        "PATCH",
        `/pages/${encodeURIComponent(mouvementId)}`,
        { properties: { [P.mouvement.statut]: { select: { name: statut } } } },
        { rejouable: true },
      );
      return versMouvement(page);
    },

    async incoherences() {
      const pages = await interroger(bases.historique, {
        filtre: { property: P.mouvement.controle, formula: { string: { contains: "vérifier" } } },
        limite: 200,
      });
      const carte = await carteProduits();
      return Promise.all(pages.map((p) => versMouvement(p, carte)));
    },
  };
}
