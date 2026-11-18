// MON STOCK — interface. Aucune modification n'est envoyée avant le bouton CONFIRMER.

import { appel, ErreurReseau, MODE_DEMO } from "./api.js";
import { ACTIVITES, TYPES, arrondi, avecUnite, calculerOperation, formaterNombre, normaliser } from "./core/regles.js";

const $app = document.getElementById("app");

/* ---------- Outils ---------- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const svg = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

const I = {
  entree: svg('<path d="M12 3v10m0 0-4-4m4 4 4-4"/><path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>'),
  sortie: svg('<path d="M12 14V4m0 0L8 8m4-4 4 4"/><path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>'),
  produits: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>'),
  alertes: svg('<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5m0 3h.01"/>'),
  historique: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  recherche: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  controle: svg('<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
  retour: svg('<path d="m15 5-7 7 7 7"/>'),
  suite: svg('<path d="m9 5 7 7-7 7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  moins: svg('<path d="M5 12h14"/>'),
  crayon: svg('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
  coche: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  croix: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>'),
};

const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect width="48" height="48" rx="12" fill="#1B2230"/><rect x="9" y="22" width="14" height="16" rx="2.5" fill="#B0432A"/><rect x="25" y="22" width="14" height="16" rx="2.5" fill="#1D6A50"/><rect x="17" y="9" width="14" height="11" rx="2.5" fill="#F6F3EE"/></svg>`;

const NOMS = {
  restaurant: { titre: "BARRIO LATINO", gerer: "Gérer le stock restaurant", court: "Barrio Latino" },
  epicerie: { titre: "ÉPICERIE", gerer: "Gérer le stock épicerie", court: "Épicerie" },
};

const STATUTS = { ok: "Suffisant", faible: "Stock faible", rupture: "Rupture" };
const pastille = (s) => `<span class="pastille ${s}">${STATUTS[s]}</span>`;

const dateHeure = (iso) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    .format(new Date(iso))
    .replace(":", " h ");

const nouvelleCle = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

class Interrompu extends Error {}

function aller(hash) {
  if (location.hash === hash) afficher();
  else location.hash = hash;
}

async function obtenir(chemin, query) {
  const r = await appel("GET", chemin, { query });
  if (r.statut === 401) {
    aller("#/connexion");
    throw new Interrompu();
  }
  if (r.statut >= 400) {
    const e = new Error(r.corps?.erreur?.message || "Erreur inattendue.");
    e.code = r.corps?.erreur?.code;
    throw e;
  }
  return r.corps;
}

function messageErreur(e) {
  if (e instanceof ErreurReseau || e.reseau) {
    return navigator.onLine
      ? "Impossible de joindre le serveur ou Notion. Réessayez dans un instant."
      : "Pas de connexion. Les stocks ne peuvent pas être consultés.";
  }
  return e.message || "Erreur inattendue.";
}

const blocErreur = (e) => `
  <div class="avis erreur" role="alert">${I.alertes}<span>${esc(messageErreur(e))}</span></div>
  <div class="barre-action"><button class="bouton neutre" data-reessayer>Réessayer</button></div>`;

function barre(titre, retour, sousTitre = "") {
  return `<header class="barre">
    <a class="bouton-retour" href="${retour}" aria-label="Retour">${I.retour}</a>
    <h1>${esc(titre)}${sousTitre ? `<span class="sous-titre">${esc(sousTitre)}</span>` : ""}</h1>
    <span></span>
  </header>`;
}

function themer(activite) {
  $app.className = activite ? `t-${activite}` : "";
}

/* ---------- Routage ---------- */

let jeton = 0;

function route() {
  const h = location.hash.slice(1) || "/";
  const [chemin, qs = ""] = h.split("?");
  return { parties: chemin.split("/").filter(Boolean), q: Object.fromEntries(new URLSearchParams(qs)) };
}

async function afficher() {
  const n = ++jeton;
  const { parties, q } = route();
  const [ecran, a, b] = parties;
  const actif = () => n === jeton;
  themer(ACTIVITES[a] ? a : null);
  window.scrollTo(0, 0);
  try {
    if (!ecran) await accueil(actif);
    else if (ecran === "connexion") connexion();
    else if (ecran === "activite" && ACTIVITES[a]) await activite(a, actif);
    else if (ecran === "produit" && ACTIVITES[a] && b) await produit(a, b, actif);
    else if (ecran === "mouvement" && TYPES[a]) {
      themer(ACTIVITES[b] ? b : null);
      await mouvement(a, ACTIVITES[b] ? b : null, q.produit, actif);
    } else if (ecran === "recherche") await recherche(actif);
    else if (ecran === "historique") await historique(q, actif);
    else if (ecran === "alertes") await alertes(q.activite, actif);
    else if (ecran === "controle") await controle(actif);
    else aller("#/");
  } catch (e) {
    if (e instanceof Interrompu || !actif()) return;
    const zone = $app.querySelector("[data-contenu]") || $app;
    zone.innerHTML = (zone === $app ? barre("MON STOCK", "#/") : "") + blocErreur(e);
    zone.querySelector("[data-reessayer]")?.addEventListener("click", afficher);
  }
  if (actif()) $app.focus({ preventScroll: true });
}

/* ---------- Accueil ---------- */

function carteEspace(act) {
  const nom = NOMS[act];
  return `<section class="espace t-${act}" aria-labelledby="titre-${act}">
    <a class="espace-tete" href="#/activite/${act}">
      <span><span class="nom" id="titre-${act}">${nom.titre}</span><span class="gerer">${nom.gerer}</span></span>
      <span class="compte" data-compte="${act}"><strong>–</strong>références</span>
      ${I.suite}
    </a>
    <div class="espace-actions">
      <a class="action principale" href="#/mouvement/sortie/${act}">${I.sortie}<span>Enregistrer une sortie</span></a>
      <a class="action secondaire" href="#/mouvement/entree/${act}">${I.entree}<span>Ajouter une entrée</span></a>
      <a class="action" href="#/activite/${act}">${I.produits}<span>Consulter les produits</span></a>
      <a class="action" href="#/alertes?activite=${act}">${I.alertes}<span>Voir les alertes</span><span class="badge" data-badge="${act}" hidden></span></a>
    </div>
  </section>`;
}

async function accueil(actif) {
  $app.innerHTML = `
    <header class="accueil-tete">
      <p class="marque">${LOGO}<span>MON STOCK</span></p>
      <h1>Que souhaitez-vous gérer aujourd’hui&nbsp;?</h1>
    </header>
    <div data-resume></div>
    ${carteEspace("restaurant")}
    ${carteEspace("epicerie")}
    <h2 class="titre-section">Accès rapide</h2>
    <nav class="raccourcis" aria-label="Accès rapide">
      <a class="raccourci" href="#/historique">${I.historique}Historique</a>
      <a class="raccourci" href="#/alertes">${I.alertes}Stocks faibles</a>
      <a class="raccourci" href="#/recherche">${I.recherche}Rechercher</a>
      <a class="raccourci" href="#/controle">${I.controle}Contrôle</a>
    </nav>
    <p class="pied">Source des données&nbsp;: Notion${MODE_DEMO ? " (démonstration)" : ` · <button type="button" data-deconnexion>Se déconnecter</button>`}</p>`;

  $app.querySelector("[data-deconnexion]")?.addEventListener("click", async () => {
    try {
      await appel("POST", "/api/deconnexion");
    } finally {
      aller("#/connexion");
    }
  });

  const resume = $app.querySelector("[data-resume]");
  try {
    const a = await obtenir("/api/alertes");
    if (!actif()) return;
    let ruptures = 0;
    let faibles = 0;
    for (const act of Object.keys(ACTIVITES)) {
      const x = a[act];
      ruptures += x.ruptures.length;
      faibles += x.faibles.length;
      $app.querySelector(`[data-compte="${act}"] strong`).textContent = x.references;
      const badge = $app.querySelector(`[data-badge="${act}"]`);
      const total = x.ruptures.length + x.faibles.length;
      if (total) {
        badge.hidden = false;
        badge.textContent = total;
        badge.classList.toggle("faible", x.ruptures.length === 0);
        badge.setAttribute("aria-label", `${total} alerte${total > 1 ? "s" : ""}`);
      }
    }
    const morceaux = [];
    if (ruptures) morceaux.push(`${ruptures} rupture${ruptures > 1 ? "s" : ""}`);
    if (faibles) morceaux.push(`${faibles} stock${faibles > 1 ? "s" : ""} faible${faibles > 1 ? "s" : ""}`);
    resume.innerHTML = morceaux.length
      ? `<a class="resume-alertes" href="#/alertes">${I.alertes}<span>${morceaux.join(" · ")}</span>${I.suite}</a>`
      : `<p class="resume-alertes calme">${I.coche}<span>Aucune alerte de stock</span></p>`;
  } catch (e) {
    if (e instanceof Interrompu) throw e;
    if (actif()) resume.innerHTML = `<div class="avis erreur" role="alert">${I.alertes}<span>${esc(messageErreur(e))}</span></div>`;
  }
}

/* ---------- Connexion ---------- */

function connexion() {
  themer(null);
  $app.innerHTML = `<form class="connexion" data-connexion>
      <p class="marque">${LOGO}<span>MON STOCK</span></p>
      <p class="intro">Entrez votre code d’accès.</p>
      <label class="visuellement-cache" for="code">Code d’accès</label>
      <input class="champ" id="code" name="code" type="password" inputmode="numeric" autocomplete="current-password" required>
      <div data-message></div>
      <div class="barre-action"><button class="bouton" type="submit">Ouvrir</button></div>
    </form>`;
  const form = $app.querySelector("[data-connexion]");
  const bouton = form.querySelector("button");
  form.code.focus();
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (bouton.disabled) return;
    bouton.disabled = true;
    bouton.setAttribute("aria-busy", "true");
    const zone = form.querySelector("[data-message]");
    try {
      const r = await appel("POST", "/api/connexion", { corps: { code: form.code.value } });
      if (r.statut === 200) return aller("#/");
      zone.innerHTML = `<div class="avis erreur" role="alert">${I.alertes}<span>${esc(r.corps?.erreur?.message || "Connexion refusée.")}</span></div>`;
    } catch (e) {
      zone.innerHTML = `<div class="avis erreur" role="alert">${I.alertes}<span>${esc(messageErreur(e))}</span></div>`;
    }
    bouton.disabled = false;
    bouton.removeAttribute("aria-busy");
  });
}

/* ---------- Listes de produits ---------- */

const ligneProduit = (p, act) => `<li><a class="ligne" href="#/produit/${act}/${encodeURIComponent(p.id)}">
    <span class="nom">${esc(p.nom)}</span>
    <span class="quantite">${avecUnite(p.quantite, p.unite)}</span>
    <span class="detail">${esc(p.categorie || "")}</span>
    ${pastille(p.statut)}
  </a></li>`;

const FILTRES = [
  ["tous", "Tous"],
  ["disponibles", "Disponibles"],
  ["faible", "Stocks faibles"],
  ["rupture", "Ruptures"],
];

async function activite(act, actif) {
  const nom = NOMS[act];
  $app.innerHTML = `${barre(nom.gerer, "#/", nom.court)}
    <div data-contenu><p class="chargement">Chargement des produits…</p></div>`;
  const { produits } = await obtenir("/api/produits", { activite: act });
  if (!actif()) return;
  let filtre = "tous";
  let texte = "";
  const zone = $app.querySelector("[data-contenu]");
  zone.innerHTML = `
    <div class="recherche">${I.recherche}<label class="visuellement-cache" for="r">Rechercher un produit</label>
      <input id="r" type="search" placeholder="Rechercher un produit" autocomplete="off" enterkeyhint="search"></div>
    <div class="puces" role="group" aria-label="Filtrer">${FILTRES.map(([k, l]) => `<button class="puce" data-filtre="${k}" aria-pressed="${k === "tous"}">${l}</button>`).join("")}</div>
    <div data-liste></div>
    <div class="barre-action deux">
      <a class="bouton neutre" href="#/mouvement/entree/${act}">${I.entree}Entrée</a>
      <a class="bouton" href="#/mouvement/sortie/${act}">${I.sortie}Sortie</a>
    </div>`;
  const liste = zone.querySelector("[data-liste]");
  const rendre = () => {
    const r = normaliser(texte);
    const vus = produits.filter(
      (p) =>
        (!r || normaliser(p.nom).includes(r)) &&
        (filtre === "tous" || (filtre === "disponibles" ? p.statut !== "rupture" : p.statut === filtre)),
    );
    liste.innerHTML = vus.length
      ? `<ul class="liste">${vus.map((p) => ligneProduit(p, act)).join("")}</ul>
         <p class="aide">${vus.length} produit${vus.length > 1 ? "s" : ""} sur ${produits.length}</p>`
      : `<p class="vide">${produits.length ? "Aucun produit ne correspond." : "Aucun produit dans ce stock pour l’instant."}</p>`;
  };
  zone.querySelector("#r").addEventListener("input", (e) => {
    texte = e.target.value;
    rendre();
  });
  zone.querySelectorAll("[data-filtre]").forEach((b) =>
    b.addEventListener("click", () => {
      filtre = b.dataset.filtre;
      zone.querySelectorAll("[data-filtre]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      rendre();
    }),
  );
  rendre();
}

/* ---------- Fiche produit ---------- */

function signeMouvement(m) {
  if (m.type === "correction") return `<span class="signe corr">${formaterNombre(m.stockAvant)} → ${avecUnite(m.stockApres, m.unite)}</span>`;
  const plus = m.type === "entree";
  return `<span class="signe ${plus ? "plus" : "moins"}">${plus ? "+" : "−"}${avecUnite(m.quantite, m.unite)}</span>`;
}

const ligneMouvement = (m, { avecProduit = true } = {}) => `<li class="t-${m.activite}"><div class="ligne mouvement">
    <span class="nom">${avecProduit ? esc(m.produitNom) : TYPES[m.type].nom}</span>
    <span class="quantite">${signeMouvement(m)}</span>
    <span class="detail">${avecProduit ? `${TYPES[m.type].nom} · ` : ""}${dateHeure(m.date)}${m.motif ? ` · ${esc(m.motif)}` : ""}</span>
    <span class="etiquette">${m.statut === "Validé" ? NOMS[m.activite].court : esc(m.statut)}</span>
  </div></li>`;

async function produit(act, id, actif) {
  $app.innerHTML = `${barre("Produit", `#/activite/${act}`, NOMS[act].court)}<div data-contenu><p class="chargement">Chargement…</p></div>`;
  const { produit: p, mouvements } = await obtenir(`/api/produits/${act}/${encodeURIComponent(id)}`);
  if (!actif()) return;
  const lien = (type) => `#/mouvement/${type}/${act}?produit=${encodeURIComponent(p.id)}`;
  $app.querySelector("[data-contenu]").innerHTML = `
    <article class="fiche">
      <h2 class="nom-produit">${esc(p.nom)}</h2>
      <p class="meta">${esc(NOMS[act].court)}${p.categorie ? ` · ${esc(p.categorie)}` : ""}</p>
      <div class="stock"><span><span class="libelle">Quantité disponible</span><strong>${avecUnite(p.quantite, p.unite)}</strong></span>${pastille(p.statut)}</div>
      <dl class="grille-infos">
        <div><dt>Stock minimum</dt><dd>${p.stockMinimum ?? "Non défini"}</dd></div>
        <div><dt>Unité</dt><dd>${esc(p.unite || "–")}</dd></div>
        ${p.fournisseur ? `<div><dt>Fournisseur</dt><dd>${esc(p.fournisseur)}</dd></div>` : ""}
        ${p.prixVente ? `<div><dt>Prix de vente</dt><dd>${formaterNombre(p.prixVente)}&nbsp;€</dd></div>` : ""}
      </dl>
    </article>
    <div class="espace-actions trois">
      <a class="action principale" href="${lien("sortie")}">${I.sortie}<span>Sortie</span></a>
      <a class="action secondaire" href="${lien("entree")}">${I.entree}<span>Entrée</span></a>
      <a class="action" href="${lien("correction")}">${I.crayon}<span>Corriger</span></a>
    </div>
    <h2 class="titre-section">Derniers mouvements</h2>
    ${mouvements.length ? `<ul class="liste">${mouvements.map((m) => ligneMouvement(m, { avecProduit: false })).join("")}</ul>` : `<p class="vide">Aucun mouvement pour ce produit.</p>`}`;
}

/* ---------- Mouvements : entrée, sortie, correction ---------- */

let formulaire = null;

const TEXTES = {
  entree: { titre: "Ajouter une entrée", champ: "Quantité reçue", confirmer: "CONFIRMER L’ENTRÉE", fait: "Entrée enregistrée", nouveau: "Nouvelle entrée", recap: "Quantité reçue" },
  sortie: { titre: "Enregistrer une sortie", champ: "Quantité à retirer", confirmer: "CONFIRMER LA SORTIE", fait: "Sortie enregistrée", nouveau: "Nouvelle sortie", recap: "Quantité à retirer" },
  correction: { titre: "Corriger le stock", champ: "Quantité réelle comptée", confirmer: "CONFIRMER LA CORRECTION", fait: "Correction enregistrée", nouveau: "Nouvelle correction", recap: "Quantité comptée" },
};

async function mouvement(type, act, produitId, actif) {
  const t = TEXTES[type];
  if (!act) {
    $app.innerHTML = `${barre(t.titre, "#/")}
      <h2 class="titre-section">Choisissez l’activité</h2>
      <div class="choix-activite">
        ${Object.keys(ACTIVITES).map((a) => `<a class="t-${a}" href="#/mouvement/${type}/${a}"><span><span class="nom">${NOMS[a].titre}</span><br><span class="gerer">${NOMS[a].gerer}</span></span>${I.suite}</a>`).join("")}
      </div>`;
    return;
  }

  formulaire = { type, act, etape: "produit", produit: null, valeur: "", motif: "", cle: nouvelleCle(), envoi: false, resultat: null, message: null };
  $app.innerHTML = `${barre(t.titre, "#/", NOMS[act].court)}<div data-contenu><p class="chargement">Chargement des produits…</p></div>`;
  const { produits } = await obtenir("/api/produits", { activite: act });
  if (!actif()) return;
  formulaire.produits = produits;
  if (produitId) {
    formulaire.produit = produits.find((p) => p.id === produitId) || null;
    if (formulaire.produit) formulaire.etape = "saisie";
  }
  rendreFormulaire();
}

function retourFormulaire() {
  const f = formulaire;
  if (f.etape === "saisie") f.etape = "produit";
  else if (f.etape === "recap") f.etape = "saisie";
  else return aller(`#/activite/${f.act}`);
  rendreFormulaire();
}

function rendreFormulaire() {
  const f = formulaire;
  const t = TEXTES[f.type];
  $app.innerHTML = `${barre(t.titre, "#", NOMS[f.act].court)}<div data-contenu></div>`;
  const retour = $app.querySelector(".bouton-retour");
  retour.addEventListener("click", (e) => {
    e.preventDefault();
    if (!f.envoi) retourFormulaire();
  });
  const zone = $app.querySelector("[data-contenu]");
  ({ produit: etapeProduit, saisie: etapeSaisie, recap: etapeRecap, resultat: etapeResultat })[f.etape](zone, f, t);
  window.scrollTo(0, 0);
}

function etapeProduit(zone, f) {
  zone.innerHTML = `
    <div class="recherche">${I.recherche}<label class="visuellement-cache" for="r">Rechercher un produit</label>
      <input id="r" type="search" placeholder="Rechercher le produit" autocomplete="off" enterkeyhint="search"></div>
    <div data-liste></div>`;
  const liste = zone.querySelector("[data-liste]");
  const rendre = (texte) => {
    const r = normaliser(texte);
    const vus = f.produits.filter((p) => !r || normaliser(p.nom).includes(r));
    liste.innerHTML = vus.length
      ? `<ul class="liste">${vus.map((p) => `<li><button class="ligne" data-id="${esc(p.id)}">
            <span class="nom">${esc(p.nom)}</span><span class="quantite">${avecUnite(p.quantite, p.unite)}</span>
            <span class="detail">${esc(p.categorie || "")}</span>${pastille(p.statut)}</button></li>`).join("")}</ul>`
      : `<p class="vide">${f.produits.length ? "Aucun produit ne correspond." : "Aucun produit dans ce stock pour l’instant."}</p>`;
    liste.querySelectorAll("[data-id]").forEach((b) =>
      b.addEventListener("click", () => {
        f.produit = f.produits.find((p) => p.id === b.dataset.id);
        f.valeur = "";
        f.motif = "";
        f.message = null;
        f.cle = nouvelleCle();
        f.etape = "saisie";
        rendreFormulaire();
      }),
    );
  };
  const champ = zone.querySelector("#r");
  champ.addEventListener("input", () => rendre(champ.value));
  rendre("");
}

/** Calcule l'aperçu sans rien envoyer ; renvoie { calcul, erreur }. */
function simuler(f) {
  try {
    const calcul = calculerOperation({
      type: f.type,
      stock: f.produit.quantite,
      quantite: f.valeur,
      nouvelleQuantite: f.valeur,
      motif: f.type === "correction" ? f.motif || "provisoire" : f.motif,
    });
    if (f.type === "correction" && !f.motif.trim()) return { calcul, erreur: null, motifManquant: true };
    return { calcul, erreur: null };
  } catch (e) {
    return { calcul: null, erreur: e };
  }
}

function avertissements(p, apres) {
  if (apres === null || apres === undefined) return "";
  if (apres <= 0) return `<div class="avis erreur">${I.alertes}<span>Après cette opération, le produit sera en rupture.</span></div>`;
  if (p.stockMinimum !== null && p.stockMinimum !== undefined && apres <= p.stockMinimum) {
    return `<div class="avis alerte">${I.alertes}<span>Après cette opération, le stock passera sous le seuil minimum (${avecUnite(p.stockMinimum, p.unite)}).</span></div>`;
  }
  return "";
}

function etapeSaisie(zone, f, t) {
  const p = f.produit;
  zone.innerHTML = `
    <article class="fiche">
      <h2 class="nom-produit">${esc(p.nom)}</h2>
      <p class="meta">${esc(NOMS[f.act].court)}${p.categorie ? ` · ${esc(p.categorie)}` : ""}</p>
      <div class="stock"><span><span class="libelle">Stock actuel</span><strong>${avecUnite(p.quantite, p.unite)}</strong></span>${pastille(p.statut)}</div>
    </article>
    ${f.message ? `<div class="avis erreur" role="alert">${I.alertes}<span>${esc(f.message)}</span></div>` : ""}
    <label class="etiquette-champ" for="q">${t.champ}${p.unite ? ` (${esc(p.unite)})` : ""}</label>
    <div class="compteur">
      <button type="button" data-pas="-1" aria-label="Moins un">${I.moins}</button>
      <input id="q" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${esc(f.valeur)}" placeholder="0">
      <button type="button" data-pas="1" aria-label="Plus un">${I.plus}</button>
    </div>
    <div data-apercu aria-live="polite"></div>
    <label class="etiquette-champ" for="motif">${f.type === "correction" ? "Motif de la correction (obligatoire)" : f.type === "entree" ? "Commentaire (facultatif)" : "Motif (facultatif)"}</label>
    <textarea id="motif" maxlength="500" placeholder="${f.type === "correction" ? "Ex. : inventaire, casse, erreur de saisie" : f.type === "entree" ? "Ex. : livraison Métro" : "Ex. : service du soir, casse"}">${esc(f.motif)}</textarea>
    <div class="barre-action"><button class="bouton" data-continuer>CONTINUER</button></div>`;

  const champ = zone.querySelector("#q");
  const motif = zone.querySelector("#motif");
  const apercu = zone.querySelector("[data-apercu]");
  const continuer = zone.querySelector("[data-continuer]");

  const maj = () => {
    f.valeur = champ.value;
    f.motif = motif.value;
    const { calcul, erreur, motifManquant } = simuler(f);
    const vide = String(f.valeur).trim() === "";
    if (calcul) {
      apercu.innerHTML = `<div class="apercu"><span>${f.type === "correction" ? `Différence : ${calcul.ecart > 0 ? "+" : "−"}${avecUnite(Math.abs(calcul.ecart), p.unite)}` : "Nouveau stock"}</span><strong>${avecUnite(calcul.apres, p.unite)}</strong></div>${avertissements(p, calcul.apres)}`;
    } else if (erreur && !vide && erreur.code !== "QUANTITE_MANQUANTE") {
      apercu.innerHTML = `<div class="avis erreur" role="alert">${I.alertes}<span>${esc(erreur.message)}</span></div>`;
    } else {
      apercu.innerHTML = "";
    }
    continuer.disabled = !calcul || Boolean(motifManquant);
  };
  champ.addEventListener("input", maj);
  motif.addEventListener("input", maj);
  zone.querySelectorAll("[data-pas]").forEach((b) =>
    b.addEventListener("click", () => {
      const actuel = Number(String(champ.value).replace(",", ".")) || 0;
      champ.value = formaterNombre(Math.max(0, arrondi(actuel + Number(b.dataset.pas)))).replace(/\s/g, "");
      maj();
    }),
  );
  continuer.addEventListener("click", () => {
    maj();
    if (continuer.disabled) return;
    f.message = null;
    f.cle = nouvelleCle(); // nouvelle saisie = nouvelle opération
    f.etape = "recap";
    rendreFormulaire();
  });
  maj();
  if (!f.valeur) champ.focus();
}

function etapeRecap(zone, f, t) {
  const p = f.produit;
  const { calcul } = simuler(f);
  zone.innerHTML = `
    <h2 class="titre-section">Vérifiez avant de confirmer</h2>
    <dl class="recap">
      <div><dt>Activité</dt><dd>${esc(NOMS[f.act].court)}</dd></div>
      <div><dt>Produit</dt><dd>${esc(p.nom)}</dd></div>
      <div><dt>Stock actuel</dt><dd>${avecUnite(calcul.avant, p.unite)}</dd></div>
      ${f.type === "correction"
        ? `<div><dt>Nouvelle quantité</dt><dd>${avecUnite(calcul.apres, p.unite)}</dd></div>
           <div><dt>Différence</dt><dd>${calcul.ecart > 0 ? "+" : "−"}${avecUnite(Math.abs(calcul.ecart), p.unite)}</dd></div>`
        : `<div><dt>${t.recap}</dt><dd>${f.type === "sortie" ? "−" : "+"}${avecUnite(calcul.quantite, p.unite)}</dd></div>`}
      <div class="fort"><dt>Nouveau stock</dt><dd>${avecUnite(calcul.apres, p.unite)}</dd></div>
      ${f.motif.trim() ? `<div><dt>Motif</dt><dd>${esc(f.motif.trim())}</dd></div>` : ""}
    </dl>
    ${avertissements(p, calcul.apres)}
    <p class="rappel">Rien n’est enregistré tant que vous n’avez pas appuyé sur «&nbsp;${t.confirmer.toLowerCase()}&nbsp;».</p>
    <div class="barre-action deux">
      <button class="bouton neutre" data-annuler>ANNULER</button>
      <button class="bouton" data-confirmer>${t.confirmer}</button>
    </div>`;

  const confirmer = zone.querySelector("[data-confirmer]");
  const annuler = zone.querySelector("[data-annuler]");
  annuler.addEventListener("click", () => {
    if (!f.envoi) aller(`#/activite/${f.act}`);
  });
  confirmer.addEventListener("click", () => envoyer(f, calcul, confirmer, annuler));
}

async function envoyer(f, calcul, confirmer, annuler) {
  if (f.envoi) return; // double appui : ignoré
  f.envoi = true;
  confirmer.disabled = true;
  annuler.disabled = true;
  confirmer.setAttribute("aria-busy", "true");
  confirmer.textContent = "Enregistrement dans Notion…";

  const fin = (resultat) => {
    f.envoi = false;
    f.resultat = resultat;
    f.etape = "resultat";
    rendreFormulaire();
  };

  if (!navigator.onLine) {
    return fin({ ok: false, reseau: true, message: "Pas de connexion. L’opération n’a pas été envoyée." });
  }

  const corps = {
    cle: f.cle,
    activite: f.act,
    produitId: f.produit.id,
    type: f.type,
    stockAttendu: calcul.avant,
    motif: f.motif.trim(),
    ...(f.type === "correction" ? { nouvelleQuantite: calcul.apres } : { quantite: calcul.quantite }),
  };

  let r;
  try {
    r = await appel("POST", "/api/mouvements", { corps, delaiMs: 30_000 });
  } catch {
    return fin({
      ok: false,
      reseau: true,
      message: "La connexion a été perdue avant la réponse de Notion. Considérez l’opération comme non enregistrée.",
    });
  }

  if (r.statut === 201 || (r.statut === 200 && r.corps.doublon)) {
    f.produit = r.corps.produit || f.produit;
    return fin({ ok: true, doublon: Boolean(r.corps.doublon), mouvement: r.corps.mouvement, produit: r.corps.produit });
  }
  if (r.statut === 401) {
    f.envoi = false;
    return aller("#/connexion");
  }
  const err = r.corps?.erreur || {};
  if (err.code === "STOCK_CHANGE") {
    f.envoi = false;
    f.produit = { ...f.produit, quantite: err.stock };
    f.message = err.message;
    f.etape = "saisie";
    return rendreFormulaire();
  }
  return fin({ ok: false, code: err.code, message: err.message || "Erreur inattendue." });
}

function etapeResultat(zone, f, t) {
  const r = f.resultat;
  const p = r.produit || f.produit;
  if (r.ok) {
    zone.innerHTML = `
      <div class="resultat" role="status">
        <div class="rond">${I.coche}</div>
        <h2>${t.fait}</h2>
        <p class="message">${r.doublon ? "Cette opération était déjà enregistrée : elle n’a pas été comptée deux fois." : `${MODE_DEMO ? "Enregistré (démonstration)" : "Confirmé par Notion"} · MVT-${esc(r.mouvement.numero)}`}</p>
        <p class="nouveau">Nouveau stock de ${esc(p.nom)}<strong>${avecUnite(p.quantite, p.unite)}</strong></p>
      </div>
      ${p.statut === "rupture" ? `<div class="avis erreur" role="alert">${I.alertes}<span>Rupture de stock&nbsp;: ${esc(p.nom)} est à zéro.</span></div>` : ""}
      ${p.statut === "faible" ? `<div class="avis alerte" role="alert">${I.alertes}<span>Stock faible&nbsp;: minimum fixé à ${avecUnite(p.stockMinimum, p.unite)}.</span></div>` : ""}
      <div class="barre-action deux">
        <a class="bouton neutre" href="#/">Accueil</a>
        <button class="bouton" data-encore>${t.nouveau}</button>
      </div>`;
    zone.querySelector("[data-encore]").addEventListener("click", () => {
      Object.assign(f, { etape: "produit", produit: null, valeur: "", motif: "", resultat: null, message: null, cle: nouvelleCle() });
      obtenir("/api/produits", { activite: f.act })
        .then(({ produits }) => {
          f.produits = produits;
          rendreFormulaire();
        })
        .catch(() => aller(`#/mouvement/${f.type}/${f.act}`));
    });
    return;
  }

  const metier = !r.reseau && r.code && !["NOTION_INDISPONIBLE", "VERIFICATION_ECHOUEE", "EN_COURS"].includes(r.code);
  zone.innerHTML = `
    <div class="resultat echec" role="alert">
      <div class="rond">${I.croix}</div>
      <h2>NON ENREGISTRÉ</h2>
      <p class="message">${esc(r.message)}</p>
      <p class="message">Le stock n’a pas été modifié.</p>
    </div>
    ${r.reseau ? `<div class="avis info">${I.info}<span>Réessayer ne crée jamais de doublon&nbsp;: si l’envoi précédent était passé, il sera reconnu.</span></div>` : ""}
    ${r.code === "VERIFICATION_ECHOUEE" || r.code === "EN_COURS" ? `<div class="avis alerte">${I.alertes}<span>Ouvrez «&nbsp;Contrôle&nbsp;» ou l’historique avant de recommencer.</span></div>` : ""}
    <div class="barre-action deux">
      <a class="bouton neutre" href="#/activite/${f.act}">Abandonner</a>
      ${metier
        ? `<button class="bouton" data-modifier>Modifier</button>`
        : r.code === "VERIFICATION_ECHOUEE" || r.code === "EN_COURS"
          ? `<a class="bouton" href="#/controle">Contrôle</a>`
          : `<button class="bouton" data-reessayer>Réessayer</button>`}
    </div>`;
  zone.querySelector("[data-modifier]")?.addEventListener("click", () => {
    f.etape = "saisie";
    f.message = r.message;
    rendreFormulaire();
  });
  // Réessayer ramène au récapitulatif : il faut confirmer de nouveau (même clé, donc sans doublon).
  zone.querySelector("[data-reessayer]")?.addEventListener("click", () => {
    f.etape = "recap";
    rendreFormulaire();
  });
}

/* ---------- Recherche ---------- */

async function recherche(actif) {
  $app.innerHTML = `${barre("Rechercher un produit", "#/")}
    <div class="recherche">${I.recherche}<label class="visuellement-cache" for="r">Nom du produit</label>
      <input id="r" type="search" placeholder="Nom du produit" autocomplete="off" enterkeyhint="search"></div>
    <div data-contenu><p class="chargement">Chargement…</p></div>`;
  const champ = $app.querySelector("#r");
  champ.focus();
  const [resto, epi] = await Promise.all([
    obtenir("/api/produits", { activite: "restaurant" }),
    obtenir("/api/produits", { activite: "epicerie" }),
  ]);
  if (!actif()) return;
  const listes = { restaurant: resto.produits, epicerie: epi.produits };
  const zone = $app.querySelector("[data-contenu]");
  const rendre = () => {
    const r = normaliser(champ.value);
    if (!r) {
      zone.innerHTML = `<p class="vide">Tapez le nom d’un produit. Les résultats du restaurant et de l’épicerie restent séparés.</p>`;
      return;
    }
    zone.innerHTML = Object.keys(ACTIVITES)
      .map((act) => {
        const vus = listes[act].filter((p) => normaliser(p.nom).includes(r));
        return `<section class="t-${act}"><h2 class="groupe-titre">${NOMS[act].court}</h2>
          ${vus.length ? `<ul class="liste">${vus.map((p) => ligneProduit(p, act)).join("")}</ul>` : `<p class="aide">Aucun produit trouvé dans ce stock.</p>`}</section>`;
      })
      .join("");
  };
  champ.addEventListener("input", rendre);
  rendre();
}

/* ---------- Historique ---------- */

const filtresHistorique = { activite: "", type: "", jours: "7", date: "" };

async function historique(q, actif) {
  if (q.activite !== undefined) filtresHistorique.activite = q.activite;
  const f = filtresHistorique;
  const puces = (cle, options) =>
    options.map(([v, l]) => `<button class="puce" data-cle="${cle}" data-valeur="${v}" aria-pressed="${f[cle] === v && !(cle === "jours" && f.date)}">${l}</button>`).join("");
  $app.innerHTML = `${barre("Historique", "#/")}
    <div class="groupe-puces"><div class="puces" role="group" aria-label="Activité">${puces("activite", [["", "Les deux activités"], ["restaurant", "Barrio Latino"], ["epicerie", "Épicerie"]])}</div></div>
    <div class="groupe-puces"><div class="puces" role="group" aria-label="Type">${puces("type", [["", "Tous types"], ["entree", "Entrées"], ["sortie", "Sorties"], ["correction", "Corrections"]])}</div></div>
    <div class="groupe-puces"><div class="puces" role="group" aria-label="Période">${puces("jours", [["1", "Aujourd’hui"], ["7", "7 jours"], ["30", "30 jours"], ["", "Toute la période"]])}
      <label class="visuellement-cache" for="jour">Date précise</label><input id="jour" class="puce" type="date" value="${esc(f.date)}" aria-label="Date précise"></div></div>
    <div data-contenu><p class="chargement">Chargement…</p></div>`;
  $app.querySelectorAll("[data-cle]").forEach((b) =>
    b.addEventListener("click", () => {
      f[b.dataset.cle] = b.dataset.valeur;
      if (b.dataset.cle === "jours") f.date = "";
      historique({}, () => true).catch(() => {});
    }),
  );
  $app.querySelector("#jour").addEventListener("change", (e) => {
    f.date = e.target.value;
    historique({}, () => true).catch(() => {});
  });
  const query = { activite: f.activite, type: f.type, ...(f.date ? { date: f.date } : { jours: f.jours }), limite: 200 };
  const { mouvements } = await obtenir("/api/mouvements", query);
  if (!actif()) return;
  $app.querySelector("[data-contenu]").innerHTML = mouvements.length
    ? `<ul class="liste">${mouvements.map((m) => ligneMouvement(m)).join("")}</ul><p class="aide">${mouvements.length} mouvement${mouvements.length > 1 ? "s" : ""}</p>`
    : `<p class="vide">Aucun mouvement pour ces filtres.</p>`;
}

/* ---------- Alertes ---------- */

async function alertes(filtre, actif) {
  const seule = ACTIVITES[filtre] ? filtre : null;
  themer(seule);
  $app.innerHTML = `${barre(seule ? "Alertes" : "Stocks faibles et ruptures", "#/", seule ? NOMS[seule].court : "")}<div data-contenu><p class="chargement">Chargement…</p></div>`;
  const a = await obtenir("/api/alertes");
  if (!actif()) return;
  const blocs = (seule ? [seule] : Object.keys(ACTIVITES)).map((act) => {
    const { ruptures, faibles } = a[act];
    const rien = !ruptures.length && !faibles.length;
    return `<section class="t-${act}"><h2 class="groupe-titre">${NOMS[act].court}</h2>
      ${rien ? `<p class="avis succes">${I.coche}<span>Aucune alerte.</span></p>` : ""}
      ${ruptures.length ? `<h3 class="titre-section serre">Ruptures (${ruptures.length})</h3><ul class="liste">${ruptures.map((p) => ligneProduit(p, act)).join("")}</ul>` : ""}
      ${faibles.length ? `<h3 class="titre-section">Stocks faibles (${faibles.length})</h3><ul class="liste">${faibles.map((p) => ligneProduit(p, act)).join("")}</ul>` : ""}
    </section>`;
  });
  $app.querySelector("[data-contenu]").innerHTML = blocs.join("");
}

/* ---------- Contrôle (rapprochement) ---------- */

async function controle(actif) {
  $app.innerHTML = `${barre("Contrôle des stocks", "#/")}
    <p class="aide avant">Compare, pour chaque produit, la quantité affichée par Notion avec la somme des mouvements validés, et liste les opérations bloquées ou en échec.</p>
    <div data-contenu><p class="chargement">Contrôle en cours…</p></div>`;
  const c = await obtenir("/api/controle");
  if (!actif()) return;
  const libelleGravite = { erreur: "erreur", alerte: "alerte", info: "info" };
  $app.querySelector("[data-contenu]").innerHTML = `
    ${c.ok
      ? `<div class="avis succes" role="status">${I.coche}<span>Tout concorde&nbsp;: ${c.produitsVerifies} produits vérifiés, aucun mouvement bloqué.</span></div>`
      : `<div class="avis erreur" role="alert">${I.alertes}<span>${c.problemes.filter((p) => p.gravite !== "info").length} point(s) à vérifier.</span></div>`}
    ${c.problemes.length ? `<ul class="liste apres">${c.problemes.map((p) => `<li class="t-${p.activite}"><div class="ligne"><span class="nom">${esc(p.message)}</span><span class="etiquette">${libelleGravite[p.gravite]}</span><span class="detail">${NOMS[p.activite]?.court || ""}</span></div></li>`).join("")}</ul>` : ""}
    <p class="aide apres">Contrôle effectué le ${dateHeure(c.date)}.</p>
    <div class="barre-action"><button class="bouton neutre" data-relancer>Relancer le contrôle</button></div>`;
  $app.querySelector("[data-relancer]").addEventListener("click", afficher);
}

/* ---------- Démarrage ---------- */

function majConnexion() {
  document.getElementById("hors-ligne").hidden = navigator.onLine;
}

async function demarrer() {
  document.getElementById("bandeau-demo").hidden = !MODE_DEMO;
  window.addEventListener("online", majConnexion);
  window.addEventListener("offline", majConnexion);
  majConnexion();
  window.addEventListener("hashchange", afficher);

  if (!MODE_DEMO && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  if (!MODE_DEMO && route().parties[0] !== "connexion") {
    try {
      const r = await appel("GET", "/api/session");
      if (!r.corps?.connecte) return aller("#/connexion");
    } catch {
      /* hors ligne : l'écran affichera l'erreur */
    }
  }
  afficher();
}

demarrer();
