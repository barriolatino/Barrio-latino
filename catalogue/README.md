# Catalogue de l'épicerie Barrio Latino

Catalogue en ligne (produits, photos, formats, prix) et son administration.
Next.js 16 · TypeScript · Tailwind CSS 4 · PostgreSQL (Prisma 7) · Playwright.

Le cadrage (analyse, architecture, schéma, design system) est dans
[`../docs/catalogue/00-cadrage.md`](../docs/catalogue/00-cadrage.md).

## Ce que l'on peut faire sans toucher au code

| Besoin | Où |
|---|---|
| Modifier un prix | **Produits** › cliquer sur le prix › taper › Entrée |
| Mettre 20 produits en promotion | **Produits** › cocher › « Mettre en promotion » (% ou prix, date de fin) |
| Ajouter un produit | **+ Ajouter un produit** (nom, catégorie, prix suffisent) |
| Même produit, autre format | Menu ⋯ › **Dupliquer** |
| Importer 100 produits | **Importer** › modèle Excel › prévisualisation › import |
| Modifier les prix dans Excel | **Exporter** › Excel › modifier › **Importer** (reconnu par la référence) |
| Changer une photo | Fiche produit, ou **Médiathèque** › Remplacer (tous les produits suivent) |
| Créer / ordonner les catégories | **Catégories** (glisser-déposer ou flèches) |
| Catalogue PDF | **Exporter** › Générer le PDF |
| QR code vers le catalogue | **Exporter** › QR code (PNG, SVG) |
| Numéro WhatsApp, horaires, textes | **Paramètres** |
| Annuler une erreur | **Corbeille et restauration** |

## Développement local

```bash
cp .env.example .env        # puis renseigner une base PostgreSQL locale
npm install
npx prisma migrate deploy
npm run db:seed             # données de démonstration + compte admin (ADMIN_EMAIL/ADMIN_PASSWORD)
npm run db:seed:epicerie    # vos produits réels (prisma/epicerie-data.ts) ; repasse la démo en brouillon
npm run dev                 # http://localhost:3000 et http://localhost:3000/admin
```

L'extension PostgreSQL `pg_trgm` (recherche tolérante) est créée par les migrations.

Photos de démonstration : `python3 scripts/extract_pdf_catalogue.py catalogue.pdf sortie/`
extrait les packshots d'un catalogue fournisseur (une image par référence), puis
`SEED_IMAGES_DIR=sortie/images npm run db:seed`.

## Vérifications

```bash
npm run typecheck
npm run lint
npm run test:e2e            # Playwright : public, 375/768/1024/1440 px, admin, scénario critique
```

Si Chromium est déjà installé ailleurs : `PW_CHROMIUM_PATH=/chemin/vers/chromium npm run test:e2e`.

Les tests créent des produits « Produit Test … » puis les mettent à la corbeille :
les lancer sur une base de développement, jamais sur la base de production.
Les tests publics s'appuient sur les produits de démonstration (`npm run db:seed`), publiés.

## Mise en ligne (Supabase + Vercel)

1. **Supabase** : créer un projet (région Europe). Dans *Storage*, créer un bucket
   **public** nommé `media`. Récupérer les chaînes de connexion et la clé `service_role`.
2. **Vercel** : importer le dépôt GitHub, *Root Directory* = `catalogue`.
   Renseigner les variables de `.env.example` (jamais la clé service_role côté
   `NEXT_PUBLIC_`). Le build applique les migrations (`prisma migrate deploy`).
3. Ajouter dans Vercel la variable `ADMIN_SETUP_CODE` (un code de votre choix), redéployer,
   puis ouvrir `/admin` : la page d'installation crée le compte administrateur (une seule fois).
   Le tableau de bord propose ensuite « Charger ces 11 produits » (liste `prisma/epicerie-data.ts`,
   photos comprises). En ligne de commande, c'est `npm run admin:create` puis `npm run db:seed:epicerie`.
4. Domaine : ajouter `epicerie.barriolatino.fr` dans Vercel, puis l'enregistrement
   CNAME indiqué chez le registraire. Mettre à jour `NEXT_PUBLIC_SITE_URL`.

## Organisation du code

```
prisma/schema.prisma        modèle de données (source de vérité)
src/lib/catalogue.ts        lectures publiques, mises en cache
src/lib/products.ts         écritures produit : historique des prix, révisions, recherche
src/lib/revalidate.ts       invalidation du cache après chaque modification
src/lib/validation.ts       règles de saisie (formulaire, édition rapide, import)
src/lib/import.ts           import/export Excel et CSV
src/lib/storage.ts          photos : compression WebP 400/800/1200 px, stockage
src/app/(public)/           site public
src/app/admin/              administration (protégée : proxy.ts + requireAdmin)
e2e/                        tests Playwright
```

Un prix n'est jamais écrit dans un composant : il est stocké en centimes
(`priceCents`) et affiché par `formatPrice()`.
