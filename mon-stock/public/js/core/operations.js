// Opérations de MON STOCK. Elles parlent à un « magasin » (store) :
// Notion en production, une mémoire de démonstration pendant les essais.
// Chaque fonction renvoie { statut, corps } : le transport HTTP n'est pas ici.

import {
  ACTIVITES,
  TYPES,
  ErreurMetier,
  arrondi,
  avecUnite,
  calculerOperation,
  cleValide,
  statutStock,
} from "./regles.js";

const DELAI_EN_COURS_MS = 2 * 60 * 1000;

function reponse(statut, corps) {
  return { statut, corps };
}

function erreur(e) {
  if (e instanceof ErreurMetier) {
    return reponse(e.statut, { erreur: { code: e.code, message: e.message, ...e.details } });
  }
  return reponse(502, {
    erreur: {
      code: "NOTION_INDISPONIBLE",
      message: "Notion n'a pas répondu correctement. Rien n'a été confirmé.",
    },
  });
}

function verifierActivite(activite) {
  if (!ACTIVITES[activite]) throw new ErreurMetier("ACTIVITE_INVALIDE", "Activité inconnue.", 400);
}

async function produitAvecStock(store, activite, produit) {
  const quantite = arrondi(await store.stock(activite, produit.id));
  return { ...produit, activite, quantite, statut: statutStock(quantite, produit.stockMinimum) };
}

/** Le premier mouvement créé pour une clé fait foi ; les autres sont annulés. */
function gagnant(mouvements) {
  return mouvements
    .filter((m) => m.statut !== "Annulé")
    .sort((a, b) => a.numero - b.numero)[0];
}

function libelle(type, produit, calcul) {
  if (type === "correction") {
    return `Correction – ${produit.nom} – ${avecUnite(calcul.avant, produit.unite)} → ${avecUnite(calcul.apres, produit.unite)}`;
  }
  return `${TYPES[type].nom} – ${produit.nom} – ${avecUnite(calcul.quantite, produit.unite)}`;
}

export function creerOperations(store, { maintenant = () => new Date() } = {}) {
  async function reponseDoublon(m) {
    if (m.statut === "Validé") {
      const produit = await store.produit(m.activite, m.produitId);
      return reponse(200, {
        doublon: true,
        mouvement: m,
        produit: produit ? await produitAvecStock(store, m.activite, produit) : null,
      });
    }
    if (m.statut === "En cours") {
      return reponse(409, {
        erreur: {
          code: "EN_COURS",
          message: "Cette opération est déjà en cours d'enregistrement. Vérifiez l'historique avant de recommencer.",
        },
      });
    }
    return reponse(409, {
      erreur: {
        code: "ECHEC_PRECEDENT",
        message: "Cette opération a déjà échoué. Recommencez depuis le formulaire.",
      },
    });
  }

  return {
    async produits({ activite }) {
      try {
        verifierActivite(activite);
        // Notion : les quantités arrivent avec la liste (une seule requête) ; sinon produit par produit.
        const avecStock = store.produitsAvecStock
          ? (await store.produitsAvecStock(activite))
              .filter((p) => !p.archive)
              .map((p) => ({ ...p, activite, quantite: arrondi(p.quantite), statut: statutStock(arrondi(p.quantite), p.stockMinimum) }))
          : await Promise.all(
              (await store.produits(activite)).filter((p) => !p.archive).map((p) => produitAvecStock(store, activite, p)),
            );
        avecStock.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
        return reponse(200, { activite, produits: avecStock });
      } catch (e) {
        return erreur(e);
      }
    },

    async produit({ activite, id }) {
      try {
        verifierActivite(activite);
        const p = await store.produit(activite, id);
        if (!p) throw new ErreurMetier("PRODUIT_INTROUVABLE", `Ce produit n'existe pas dans le stock ${ACTIVITES[activite].court.toLowerCase()}.`, 404);
        const mouvements = await store.mouvements({ activite, produitId: id, limite: 15 });
        return reponse(200, { produit: await produitAvecStock(store, activite, p), mouvements });
      } catch (e) {
        return erreur(e);
      }
    },

    async mouvements(filtres = {}) {
      try {
        if (filtres.activite) verifierActivite(filtres.activite);
        if (filtres.type && !TYPES[filtres.type]) throw new ErreurMetier("TYPE_INVALIDE", "Type de mouvement inconnu.", 400);
        const limite = Math.min(Number(filtres.limite) || 100, 200);
        const liste = await store.mouvements({ ...filtres, limite });
        return reponse(200, { mouvements: liste });
      } catch (e) {
        return erreur(e);
      }
    },

    async alertes() {
      try {
        const resultat = {};
        for (const activite of Object.keys(ACTIVITES)) {
          const { corps } = await this.produits({ activite });
          if (corps.erreur) return reponse(502, corps);
          resultat[activite] = {
            ruptures: corps.produits.filter((p) => p.statut === "rupture"),
            faibles: corps.produits.filter((p) => p.statut === "faible"),
            references: corps.produits.length,
          };
        }
        return reponse(200, resultat);
      } catch (e) {
        return erreur(e);
      }
    },

    /**
     * Enregistre un mouvement. Ordre des contrôles :
     * clé déjà vue → produit de la bonne activité → stock inchangé depuis l'écran
     * récapitulatif → calcul (sortie ≤ stock, motif de correction) → création « En cours »
     * → arbitrage des doublons simultanés → validation → relecture du stock.
     */
    async enregistrer(entree, { utilisateur = "Clément" } = {}) {
      try {
        const { cle, activite, produitId, type } = entree || {};
        if (!cleValide(cle)) throw new ErreurMetier("CLE_INVALIDE", "Identifiant d'opération manquant. Rechargez l'application.", 400);
        verifierActivite(activite);
        if (!TYPES[type]) throw new ErreurMetier("TYPE_INVALIDE", "Type de mouvement inconnu.", 400);

        const deja = gagnant(await store.mouvementsParCle(cle));
        if (deja) return reponseDoublon(deja);

        const produit = await store.produit(activite, produitId);
        if (!produit) {
          throw new ErreurMetier(
            "PRODUIT_INTROUVABLE",
            `Ce produit n'existe pas dans le stock ${ACTIVITES[activite].court.toLowerCase()}.`,
            404,
          );
        }
        if (produit.archive) throw new ErreurMetier("PRODUIT_ARCHIVE", "Ce produit est archivé.", 422);

        const stock = arrondi(await store.stock(activite, produitId));
        if (entree.stockAttendu !== undefined && entree.stockAttendu !== null && arrondi(entree.stockAttendu) !== stock) {
          throw new ErreurMetier(
            "STOCK_CHANGE",
            `Le stock a changé entre-temps : ${avecUnite(stock, produit.unite)} au lieu de ${avecUnite(arrondi(entree.stockAttendu), produit.unite)}. Vérifiez puis confirmez à nouveau.`,
            409,
            { stock },
          );
        }

        const motif = String(entree.motif || "").trim().slice(0, 500);
        const calcul = calculerOperation({
          type,
          stock,
          quantite: entree.quantite,
          nouvelleQuantite: entree.nouvelleQuantite,
          motif,
        });

        const cree = await store.creerMouvement({
          titre: libelle(type, produit, calcul),
          cle,
          activite,
          produitId,
          type,
          quantite: calcul.quantite,
          stockAvant: calcul.avant,
          stockApres: calcul.apres,
          motif,
          utilisateur,
          date: maintenant().toISOString(),
          statut: "En cours",
        });

        // Deux envois simultanés de la même clé : le plus ancien gagne, l'autre s'annule.
        const premier = gagnant(await store.mouvementsParCle(cle));
        if (premier && premier.id !== cree.id) {
          await store.changerStatut(cree.id, "Annulé");
          return reponseDoublon(premier);
        }

        try {
          await store.changerStatut(cree.id, "Validé");
        } catch {
          try {
            await store.changerStatut(cree.id, "Échec");
          } catch {
            /* le mouvement restera « En cours » et apparaîtra dans « À vérifier » */
          }
          throw new Error("validation impossible");
        }

        // Relecture : on ne confirme que ce que Notion renvoie réellement.
        // Notion peut mettre un instant à refléter l'écriture : jusqu'à 3 relectures.
        let relu = null;
        let stockRelu = null;
        for (let essai = 0; essai < 3; essai++) {
          if (essai) await new Promise((r) => setTimeout(r, store.delaiRelectureMs ?? 600));
          try {
            relu = await store.mouvement(cree.id);
            stockRelu = arrondi(await store.stock(activite, produitId));
          } catch {
            relu = null;
          }
          if (relu?.statut === "Validé" && stockRelu === calcul.apres) break;
        }
        if (!relu || relu.statut !== "Validé" || stockRelu !== calcul.apres) {
          return reponse(502, {
            erreur: {
              code: "VERIFICATION_ECHOUEE",
              message: "Notion n'a pas confirmé le nouveau stock. Ouvrez « Contrôle » avant de recommencer.",
            },
          });
        }

        return reponse(201, {
          mouvement: relu,
          produit: { ...produit, activite, quantite: stockRelu, statut: statutStock(stockRelu, produit.stockMinimum) },
        });
      } catch (e) {
        return erreur(e);
      }
    },

    /** Rapprochement : stock affiché par Notion ↔ somme des mouvements, mouvements bloqués. */
    async controle() {
      try {
        const problemes = [];
        let produitsVerifies = 0;
        // Lecture groupée quand le magasin le permet (Notion : une dizaine de requêtes au lieu
        // de deux par produit, sinon le serveur dépasse son temps limite).
        const sommes = store.stocksTous ? await store.stocksTous() : null;
        for (const activite of Object.keys(ACTIVITES)) {
          const liste = store.produitsAvecStock ? await store.produitsAvecStock(activite) : await store.produits(activite);
          for (const p of liste) {
            produitsVerifies++;
            const somme = sommes ? arrondi(sommes.get(`${activite}:${p.id}`) || 0) : arrondi(await store.stock(activite, p.id));
            if (somme < 0) {
              problemes.push({ gravite: "erreur", activite, produitId: p.id, message: `${p.nom} : stock négatif (${avecUnite(somme, p.unite)}).` });
            }
            const affiche = p.quantite !== undefined ? p.quantite : store.stockAffiche ? await store.stockAffiche(activite, p.id) : null;
            if (affiche !== null && affiche !== undefined && arrondi(affiche) !== somme) {
              problemes.push({
                gravite: "erreur",
                activite,
                produitId: p.id,
                message: `${p.nom} : Notion affiche ${avecUnite(affiche, p.unite)}, les mouvements validés donnent ${avecUnite(somme, p.unite)}.`,
              });
            }
          }
        }
        const limite = maintenant().getTime() - DELAI_EN_COURS_MS;
        for (const m of await store.mouvements({ limite: 200, statuts: ["En cours", "Échec"] })) {
          if (m.statut === "Échec") {
            problemes.push({ gravite: "info", activite: m.activite, mouvementId: m.id, message: `${m.titre} : échec, sans effet sur le stock.` });
          } else if (new Date(m.date).getTime() < limite) {
            problemes.push({ gravite: "alerte", activite: m.activite, mouvementId: m.id, message: `${m.titre} : resté « En cours », sans effet sur le stock.` });
          }
        }
        // Filet de sécurité : une même opération validée deux fois.
        const parCle = new Map();
        for (const m of await store.mouvements({ limite: 200, statuts: ["Validé"] })) {
          if (!m.cle) continue;
          if (parCle.has(m.cle)) {
            problemes.push({ gravite: "erreur", activite: m.activite, mouvementId: m.id, message: `${m.titre} : enregistré deux fois (MVT-${parCle.get(m.cle).numero} et MVT-${m.numero}). Annulez-en un par une correction.` });
          } else parCle.set(m.cle, m);
        }
        if (store.incoherences) {
          for (const m of await store.incoherences()) {
            problemes.push({ gravite: "erreur", activite: m.activite, mouvementId: m.id, message: `${m.titre} : produit ou activité incohérents.` });
          }
        }
        return reponse(200, {
          ok: !problemes.some((p) => p.gravite !== "info"),
          produitsVerifies,
          problemes,
          date: maintenant().toISOString(),
        });
      } catch (e) {
        return erreur(e);
      }
    },
  };
}
