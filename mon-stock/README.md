# MON STOCK

Application mobile (PWA) de gestion des stocks du restaurant Barrio Latino et
de l'épicerie. **Notion est la seule base de données** : l'application n'a
aucun stock à elle. Mode d'emploi pour Clément : voir `docs/` (à venir, phase 9).

## Principes

- Quantité disponible = somme des mouvements validés (calculée par Notion).
  On ne modifie jamais une quantité : on enregistre un mouvement.
- Rien n'est envoyé avant le bouton CONFIRMER. Une opération n'est annoncée
  « enregistrée » qu'après relecture dans Notion.
- Anti-doublon : chaque opération porte une clé unique ; un second envoi de la
  même clé est reconnu, deux envois simultanés sont arbitrés (le premier gagne).
- Hors connexion : rien n'est mis en attente ni renvoyé automatiquement.
- Restaurant et épicerie : deux bases Notion distinctes ; un produit n'est
  cherché que dans la base de l'activité choisie.

## Organisation

| Fichier | Rôle |
|---|---|
| `public/` | L'application (HTML, CSS, JS sans dépendance), le manifeste et le service worker |
| `public/js/core/regles.js` | Calculs et règles (statut, sortie ≤ stock, correction avec motif) |
| `public/js/core/operations.js` | Enregistrement d'un mouvement, alertes, contrôle |
| `public/js/core/magasin-memoire.js` | Données **fictives** pour les essais et la démonstration |
| `server/` | Code d'accès, session signée, gestionnaire HTTP |
| `dev-server.js` | Serveur d'essai local, jamais relié à Notion |
| `tests/` | Essais des règles et de l'interface (iPhone simulé) |

## Essais

```bash
npm run dev     # http://localhost:8787, code 2468, données fictives
npm test        # règles + interface (Playwright déjà installé)
```

## Production (Netlify)

- `netlify.toml` : site statique `public/` + fonction `netlify/functions/api.mjs`
  pour toutes les adresses `/api/*`. Dans Netlify, « Base directory » = `mon-stock`.
- `server/magasin-notion.js` : connecteur Notion (API officielle, version 2025-09-03).
  Identifiants des bases dans `server/config-notion.js` (pas secrets).
- Variables saisies dans Netlify, jamais dans le dépôt : `NOTION_TOKEN` (clé de
  l'intégration « MON STOCK »), `MON_STOCK_CODE` (code d'accès), `MON_STOCK_SECRET`
  (32 caractères ou plus, au hasard).
- `tests/faux-notion.js` imite l'API Notion : les essais ne touchent jamais au vrai Notion.
