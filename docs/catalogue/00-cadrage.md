# Catalogue digital de l'épicerie — Cadrage (étapes 1 à 7)

Statut : **proposition à valider**. Aucun code n'est écrit tant que les décisions
de la section 9 ne sont pas tranchées.

Source analysée : *Catálogo Refrigerados y Congelados 2025* (Impex Productos
Latinos, Barcelone), 16 pages. Le second catalogue (*produits secs 2025*) n'a pas
été joint : l'analyse sera complétée dès sa réception.

---

## 1. Analyse de la structure du catalogue de référence

### Ce que contient le PDF

| Pages | Rubrique | Produits | Exemples |
|---|---|---|---|
| 1 | Couverture (logo, coordonnées, mosaïque de produits) | — | |
| 2 | Arepas y Tapas | 16 | Arepas Campesino, La Victoria, Goya |
| 3, 4, 6, 9 | Productos congelados | 61 | choclo, ajís, yuca, papa criolla, patacones, plátanos, empanadas, chorizos, salamis, pains PanPaYa |
| 5, 7, 12 | Pages publicitaires pleine page | — | Yuquesos, empanadas Tosty Fri, Coraçai |
| 8 | Quesos | 11 | Campesino, Costeño, Duro, nata ácida |
| 10, 11, 13, 14 | Pulpas & Frutas | 50 | pulpes Canoa 90 g / 250 g, SAS 100 g / 230 g, fruits entiers, açaí |
| 15 | Helados | 9 | glaces La Quindianita |
| 16 | Dos de couverture | — | |

**146 produits référencés**, répartis en 5 rubriques. Mise en page : grille fixe
de 4 colonnes, packshot détouré sur fond blanc, puis trois lignes de texte.

### Anatomie d'une fiche produit

```
[ packshot ]
Pulpa Maracuyá            ← nom (la marque est parfois dedans, parfois non)
90g. Cj x20u 0.90€        ← format · conditionnement · prix
Ref: 00102                ← référence fournisseur à 5 chiffres
```

### Les formats d'information observés

| Donnée | Notations rencontrées | Sens |
|---|---|---|
| Poids | `500g.`, `1 kg.`, `1360g.` | poids net |
| Unités dans le paquet | `Pq x5u`, `Ds x6u`, `Ds x8u` | paquet (Pq) ou présentoir/sachet (Ds) de N unités |
| Colis | `Cj x24u`, `Cj x12 Ds` | carton (Cj) de N paquets |
| Prix | `2.07€`, `0.90€`, `28.67€` | prix HT grossiste |
| Prix au poids | `Precio por kg. - 9.10€` | fromages et viande vendus au kilo |
| Référence | `Ref: 02603` | code interne Impex |

### Volumétrie et variantes

- **Un même nom pour des produits différents** : « Arepas Blancas » apparaît 3 fois
  (Campesino, La Victoria, Goya), « Patacones » 3 fois, « Pulpa Mango » 4 fois.
  Seules la marque et le format les distinguent.
- **Un même produit en plusieurs formats** : Pulpa Maracuyá 90 g et 250 g, Queso
  Campesino 300 g, au kilo en carton de 8 et au kilo en carton de 4. Cela confirme
  le besoin de la fonction « Dupliquer ».
- **Marques récurrentes** : Campesino, La Victoria, Goya, Coexito, Sabor y Sazón,
  Canoa, SAS, PanPaYa, Coraçai, La Quindianita. Une table `Brand` est justifiée.
- **Pays** : absents de la fiche, alors que l'origine est évidente pour le client
  (Sabor y Sazón = Pérou, Coraçai = Brésil, PanPaYa = Colombie).

### Les photos

Vérification technique faite sur le PDF : les 147 packshots sont des **images
séparées avec masque de transparence** (fond détouré), extractables
automatiquement avec le texte associé (nom, format, prix, référence). Le
rapprochement photo ↔ produit est donc automatisable pour l'import initial.

Limite : leur définition est faible (200 à 300 px de large). C'est suffisant pour
une vignette, mais un peu flou sur un écran Retina dans une fiche produit (il
faudrait ~800 px). Voir la décision D5.

---

## 2. Points à conserver

1. **La grille de packshots uniformes sur fond neutre.** C'est ce qui rend ce
   catalogue lisible malgré sa sobriété : l'œil reconnaît le paquet qu'il a vu en
   rayon.
2. **Un bloc d'information très court sous l'image** : nom, format, prix. Pas de
   description sur la carte.
3. **Le regroupement par famille d'usage** (arepas, pulpes, fromages, glaces).
4. **La référence visible**, utile pour commander par WhatsApp sans ambiguïté.
5. **Un produit par format** : chaque format est une ligne à part entière avec son
   prix et sa référence. Plus simple à administrer que des « variantes ».

## 3. Points à améliorer

| Problème observé | Conséquence | Réponse proposée |
|---|---|---|
| Unité du prix ambiguë : `0.90€` est le prix d'**un** sachet de pulpe, mais `28.67€` est le prix d'un **carton de 30** glaces | Le client ne sait pas ce qu'il paie | Champ explicite `saleUnit` (à l'unité / au kilo / au lot) ; libellé toujours affiché à côté du prix |
| Jargon `Pq`, `Cj`, `Ds`, `u` | Incompréhensible pour un particulier | Conditionnement écrit en clair : « Paquet de 5 », « Barquette de 6 » |
| « Productos congelados » regroupe 61 produits sans rapport (légumes, charcuterie, pains) | Rubrique fourre-tout de 4 pages | Catégories par usage + filtre transversal « Surgelé / Frais / Épicerie » |
| Marque tantôt dans le nom (« Pulpa Mango SAS »), tantôt absente | Doublons apparents, recherche par marque impossible | Marque = champ séparé, affichée sur la carte |
| Aucun pays | Impossible de chercher « produits péruviens » | Pays facultatif, filtrable |
| Données manquantes ou fausses : 1re « Arepas Blancas » sans prix ni réf., `Ref: 0`, `3.€`, `3.96` sans devise | Erreurs inévitables quand le PDF est fait à la main | Validation à la saisie ; PDF généré à partir des données |
| Point décimal (`2.07€`) | Convention espagnole/anglaise | Format français automatique : `2,07 €` |
| Pages publicitaires au milieu de la liste | Rompt la recherche d'un produit | Mises en avant placées sur l'accueil, pas entre les produits |
| Pas de prix au kilo | Information attendue du client au détail (et obligatoire en France dans de nombreux cas) | Prix au kg / au litre **calculé automatiquement** à partir du poids |
| Aucune recherche, aucun tri | 16 pages à feuilleter | Recherche instantanée, filtres, tri |

**Point de vigilance sur les prix** : les prix Impex sont des prix **grossiste HT**
par paquet, vendus au carton. Ils ne doivent servir à rien d'autre qu'à la
structure : les données de démonstration utiliseront des prix fictifs marqués
« Exemple ».

---

## 4. Architecture technique proposée

### Contexte

Le dépôt actuel héberge le site vitrine du restaurant : une page statique sur
GitHub Pages. GitHub Pages ne sait pas faire tourner une base de données ni une
administration protégée. Le catalogue sera donc **une application à part**,
servie sur un sous-domaine (par exemple `epicerie.barriolatino.fr`) et reliée au
site vitrine par un simple lien. Le site du restaurant reste inchangé.

### Pile retenue

| Besoin | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Pages publiques pré-générées (rapides, bien référencées) et administration dynamique dans un seul projet |
| Style | **Tailwind CSS** + composants maison | Les tokens du design system deviennent la config Tailwind ; pas de look « template » |
| Composants admin | **shadcn/ui** (tableaux, formulaires, modales) | Composants accessibles, copiés dans le projet donc modifiables ; uniquement côté admin |
| Base de données | **PostgreSQL** (Supabase) | Relations, recherche sans accents (`unaccent`) et tolérante aux fautes (`pg_trgm`) natives |
| ORM | **Prisma** | Schéma lisible, migrations versionnées |
| Images | **Supabase Storage** + redimensionnement à l'envoi (`sharp`) | Chaque photo est stockée en WebP en 3 tailles (400, 800, 1200 px) une fois pour toutes ; servie par CDN |
| Authentification | **Supabase Auth** (e-mail + mot de passe) | Pas de secret dans le navigateur ; vérification côté serveur sur chaque action admin |
| Validation | **Zod** | Une seule définition des règles, utilisée par le formulaire, l'import CSV et le serveur |
| Import / export | **SheetJS** (xlsx) + CSV | Lecture et écriture Excel côté serveur |
| PDF | **@react-pdf/renderer** | PDF généré depuis la base, sans navigateur headless |
| Hébergement | **Vercel** (ou Netlify) — offres gratuites | Déploiement automatique à chaque commit |
| Tests | **Playwright** | Parcours public et admin, 4 largeurs d'écran |

Supabase réunit base, stockage et authentification dans **un seul compte** : moins
de services à surveiller pour une personne non développeuse. L'offre gratuite
couvre largement 2 000 produits et leurs photos.

### Comment un changement de prix arrive chez le client

```
Admin modifie le prix ──► Server Action (vérifie session + Zod)
                              │
                              ├─► UPDATE Product.priceCents
                              ├─► INSERT PriceHistory (ancien → nouveau)
                              └─► revalidateTag("product:<id>", "catalogue")
                                        │
                                        ▼
         accueil, catalogue, catégorie, fiche, recherche régénérés
         à la requête suivante (≈ 1 s), puis resservis depuis le cache
```

Les pages publiques sont **statiques et mises en cache**, mais invalidées à
chaque modification : vitesse d'un site statique, fraîcheur d'un site dynamique.
Il n'existe qu'une seule source de vérité pour le prix : la colonne
`Product.priceCents`.

### Principes

- **Prix en centimes entiers** (`priceCents: 490`), jamais en nombre à virgule :
  aucune erreur d'arrondi. L'affichage `4,90 €` passe par une seule fonction
  `formatPrice()` basée sur `Intl.NumberFormat('fr-FR')`.
- **Aucune donnée métier dans les composants** : produits, textes d'accueil,
  numéro WhatsApp, horaires viennent de la base.
- **Suppression douce** : un produit supprimé est archivé (`deletedAt`) et
  restaurable pendant 30 jours.
- **Évolutions préparées sans être codées** : favoris, panier et commande
  s'appuieront sur les identifiants stables de `Product` ; aucune table
  inutilisée n'est créée en V1.

---

## 5. Schéma de données

Schéma Prisma simplifié. Les noms sont en anglais (code), les libellés affichés
sont en français.

```prisma
enum Storage    { AMBIENT CHILLED FROZEN }   // Épicerie · Frais · Surgelé
enum SaleUnit   { UNIT KG LOT }              // prix à l'unité · au kilo · au lot
enum Visibility { DRAFT PUBLISHED ARCHIVED }

model Product {
  id            String     @id @default(cuid())
  slug          String     @unique              // /produits/arepas-blancas-campesino-500g
  reference     String?    @unique              // facultative
  name          String
  description   String?
  brandId       String?
  categoryId    String                           // catégorie OU sous-catégorie
  countryId     String?                          // jamais forcé
  storage       Storage    @default(AMBIENT)
  netWeightG    Int?                             // 500
  volumeMl      Int?
  unitCount     Int?                             // 5 arepas dans le paquet
  packaging     String?                          // « Paquet de 5 »
  saleUnit      SaleUnit   @default(UNIT)
  priceCents    Int                              // 490 = 4,90 € ; ≥ 0 (CHECK)
  available     Boolean    @default(true)
  visibility    Visibility @default(DRAFT)
  featured      Boolean    @default(false)
  isNew         Boolean    @default(false)
  newUntil      DateTime?                        // la nouveauté expire seule
  displayOrder  Int        @default(0)
  seoTitle      String?
  seoDescription String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  deletedAt     DateTime?

  brand      Brand?         @relation(fields: [brandId], references: [id])
  category   Category       @relation(fields: [categoryId], references: [id])
  country    Country?       @relation(fields: [countryId], references: [id])
  images     ProductImage[]
  tags       ProductTag[]
  promotions Promotion[]
  priceHistory PriceHistory[]
}

model Category {                 // sous-catégorie = catégorie avec un parent
  id           String     @id @default(cuid())
  slug         String     @unique
  name         String
  description  String?
  imageId      String?
  parentId     String?
  displayOrder Int        @default(0)
  parent       Category?  @relation("Tree", fields: [parentId], references: [id])
  children     Category[] @relation("Tree")
  products     Product[]
}

model Brand   { id String @id @default(cuid())  slug String @unique  name String  logoId String?  products Product[] }
model Country { id String @id @default(cuid())  slug String @unique  name String  isoCode String @unique  // "CO" → 🇨🇴 calculé
                displayOrder Int @default(0)  products Product[] }
model Tag     { id String @id @default(cuid())  slug String @unique  name String  products ProductTag[] }
model ProductTag { productId String  tagId String  @@id([productId, tagId]) }

model Media {                    // médiathèque : une photo, plusieurs produits
  id        String   @id @default(cuid())
  path      String                   // clé dans le stockage
  alt       String?
  width     Int
  height    Int
  blurData  String?                  // aperçu flou pendant le chargement
  createdAt DateTime @default(now())
  usages    ProductImage[]
}

model ProductImage {             // remplacer l'image = changer mediaId
  productId String
  mediaId   String
  position  Int      // 0 = image principale
  @@id([productId, mediaId])
}

model Promotion {                // source unique du prix promo
  id         String    @id @default(cuid())
  productId  String
  promoCents Int                 // < priceCents (vérifié côté serveur)
  startsAt   DateTime  @default(now())
  endsAt     DateTime?           // vide = jusqu'à nouvel ordre
  label      String?             // « Fête des mères »
  createdAt  DateTime  @default(now())
}

model PriceHistory {
  id        String   @id @default(cuid())
  productId String
  kind      String              // "price" | "promo"
  oldCents  Int?
  newCents  Int?
  changedBy String
  changedAt DateTime @default(now())
}

model Revision {                 // filet de sécurité avant toute modification
  id         String   @id @default(cuid())
  entityType String              // "Product", "Category", "SiteSettings"…
  entityId   String
  snapshot   Json                // état complet AVANT la modification
  action     String              // update | delete | import
  createdBy  String
  createdAt  DateTime @default(now())
}

model SiteSettings {             // une seule ligne
  id                     Int     @id @default(1)
  shopName               String
  logoId                 String?
  faviconId              String?
  tagline                String?   // message d'accueil (hero)
  description            String?
  phone                  String?
  whatsapp               String?   // format international, jamais dans le code
  email                  String?
  address                String?
  openingHours           Json?
  instagram              String?
  facebook               String?
  tiktok                 String?
  currency               String  @default("EUR")
  footerText             String?
  unavailableBehavior    String  @default("show")  // "show" = badge Indisponible | "hide"
  newProductDays         Int     @default(30)
  colorOverrides         Json?   // nuances autorisées, bornées au design system
}

model AdminUser {                // lié au compte Supabase Auth
  id        String   @id          // = auth.users.id
  email     String   @unique
  name      String
  role      String   @default("editor")   // "owner" | "editor"
  createdAt DateTime @default(now())
}
```

### Choix commentés

- **`isPromotion` et `promotionalPrice` ne sont pas stockés sur le produit** : ils
  sont déduits de la table `Promotion` (promotion active à la date du jour). Une
  promotion peut ainsi avoir des dates de fin et s'arrêter seule. Le tableau admin
  et l'import CSV continuent d'exposer une colonne `promotionalPrice` : c'est
  l'interface, pas le stockage.
- **Sous-catégorie = catégorie enfant.** Une seule table, un seul écran de
  gestion, glisser-déposer identique ; profondeur limitée à 2 niveaux dans
  l'interface.
- **Devise unique dans les paramètres**, pas par produit : une épicerie ne vend
  pas dans deux devises, et une colonne par produit serait une source d'erreur.
- **Prix à l'unité de mesure** (`€/kg`, `€/L`) calculé à partir de `netWeightG` /
  `volumeMl`, jamais saisi.
- **Index** : `(visibility, available, displayOrder)` pour le catalogue,
  index trigramme sur `name`, marque et tags pour la recherche, `categoryId`,
  `countryId`, `brandId`. Tient sans effort au-delà de 10 000 produits.
- **Champs `createdAt`/`updatedAt`** partout ; `Revision` garde l'état avant
  chaque modification, suppression ou import (restauration en un clic depuis
  l'admin).

---

## 6. Arborescence du site

### Partie publique

```
/                         Accueil : hero, catégories, « Nos incontournables »,
                          promotions, nouveautés, contact
/catalogue                Tous les produits — recherche, filtres, tri
                          ?q=arepa&categorie=pulpes&pays=colombie&tri=prix-asc
                          (l'URL filtrée se partage telle quelle)
/categories               Toutes les catégories en cartes
/categories/[slug]        Produits d'une catégorie (+ sous-catégories)
/promotions               Produits en promotion active, économie affichée
/nouveautes               Produits marqués nouveaux
/pays                     Pays représentés (seulement ceux qui ont des produits)
/pays/[slug]              Produits d'un pays
/marques/[slug]           Produits d'une marque (gratuit grâce à la table Brand)
/produits/[slug]          Fiche produit
/contact                  Adresse, horaires, carte, WhatsApp
/mentions-legales
/confidentialite
/sitemap.xml, /robots.txt générés
```

### Administration (protégée)

```
/admin/login
/admin                    Tableau de bord : compteurs + 10 dernières modifications
/admin/products           Tableau, édition rapide en ligne, actions groupées
/admin/products/new
/admin/products/[id]      Fiche complète + historique de ses prix
/admin/categories         Arbre, glisser-déposer
/admin/brands
/admin/countries
/admin/media              Médiathèque
/admin/import             Import CSV/Excel avec prévisualisation
/admin/export             CSV, Excel, PDF, QR code
/admin/settings           Paramètres de l'épicerie
/admin/price-history      Historique de tous les prix, filtrable
/admin/revisions          Corbeille et restauration
```

### Navigation

- **Mobile** : barre du haut = logo · recherche · menu. Menu = Catalogue,
  Catégories, Promotions, Nouveautés, Pays, Contact. Bouton WhatsApp flottant
  discret sur les fiches produit uniquement.
- **Desktop** : navigation horizontale complète, recherche toujours visible.
- Fil d'Ariane sur les fiches (`Catalogue › Pulpes de fruits › Pulpa Maracuyá`)
  et retour au catalogue **avec les filtres conservés**.

### Carte produit

```
┌─────────────────────┐
│     [packshot]      │  ratio 1:1, fond crème, image contenue (jamais déformée)
│ SURGELÉ      -17 %  │  badges : conservation · promo · nouveau
├─────────────────────┤
│ Canoa · Colombie    │  marque · pays (petit, discret)
│ Pulpa Maracuyá      │  nom (2 lignes max)
│ 250 g · Sachet      │  format · conditionnement
│ 2,49 €  ~~2,99 €~~  │  prix (gros) · ancien prix barré
│ 9,96 €/kg · Réf 116 │  prix au kilo · référence
└─────────────────────┘
```

Toute la carte est cliquable vers la fiche. Grille : 2 colonnes à 375 px,
3 à 768 px, 4 à 1024 px, 5 à 1440 px.

---

## 7. Design system proposé

> Si l'épicerie partage l'identité du restaurant Barrio Latino (décision D2), le
> design system **réutilise ses couleurs et polices** et les assagit pour un
> usage catalogue. Les valeurs ci-dessous partent de cette hypothèse.

### Couleurs

Le principe : **le fond et le texte sont neutres, la couleur porte une
information**. Le packshot reste la seule zone vraiment colorée de la carte.

| Token | Valeur | Usage |
|---|---|---|
| `paper` | `#FFFDF8` | fond de page |
| `cream` | `#FBF3E5` | fond des vignettes, bandeaux |
| `ink` | `#1B1B1B` | texte principal |
| `ink-muted` | `#5B5650` | infos secondaires (marque, référence) |
| `navy` | `#12173A` | en-tête, pied de page, boutons principaux |
| `coral-text` | `#C32E16` | **promotions uniquement** : prix promo, badge −% |
| `turquoise-deep` | `#26837C` | badge **Surgelé**, liens |
| `yellow` | `#F5B921` | badge **Nouveau** (texte navy dessus) |
| `green` | `#2F6B3F` | Disponible, confirmations admin |
| `line` | `#E8E0D2` | bordures 1 px |

Tous les couples texte/fond seront vérifiés à 4,5:1 minimum (WCAG AA).

### Typographie

| Rôle | Police | Taille mobile → desktop |
|---|---|---|
| H1 | Baloo 2, 800 | 32 → 48 px |
| H2 | Baloo 2, 700 | 24 → 32 px |
| H3 | Baloo 2, 700 | 20 → 22 px |
| Nom produit | Work Sans, 600 | 15 → 16 px |
| Prix | Work Sans, 700, chiffres tabulaires | 18 → 20 px |
| Infos secondaires | Work Sans, 400 | 13 → 14 px |
| Texte courant | Work Sans, 400 | 16 px, interligne 1,5 |

Deux familles seulement, auto-hébergées (`next/font`) : aucun appel à Google
Fonts au chargement.

### Formes et espacements

- Échelle d'espacement 4 px : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- Rayons : 8 px (boutons, champs), 12 px (cartes), 999 px (badges).
- Ombres : aucune au repos ; une seule ombre légère au survol des cartes sur
  desktop. Séparation par bordures fines et fonds crème.
- Une seule texture : un motif de papel picado très pâle, uniquement dans le
  hero et le pied de page.
- Animations limitées aux transitions d'état (150 ms) ; respect de
  `prefers-reduced-motion`.

### Composants

Boutons (principal navy, secondaire contour, fantôme, WhatsApp), badges
(Surgelé, Frais, Nouveau, Promo, Indisponible), carte produit, carte catégorie,
champ de recherche, puces de filtre, tiroir de filtres mobile, pagination
« Voir plus », fil d'Ariane, galerie, tableau admin avec cellules éditables,
formulaire, modale de confirmation, toast « Enregistré », alertes d'erreur.

Une page `/admin/design-system` (masquée) affichera tous les composants pour
contrôler la cohérence.

---

## 8. Plan de développement

Chaque lot se termine par une démonstration et votre validation.

| Lot | Contenu | Résultat vérifiable |
|---|---|---|
| **0. Socle** | Projet Next.js, Supabase, Prisma, schéma, auth admin, déploiement de prévisualisation, tokens du design system | Une URL en ligne, `/admin` refuse l'accès sans connexion |
| **1. Catalogue public** | Accueil, catalogue, catégories, pays, promotions, nouveautés, fiche produit, partage, recherche sans accents, filtres, tri, SEO (URL propres, métadonnées, données structurées `Product`) | Trouver « arepa », « maracuya » ou « peru » en moins de 3 s sur mobile |
| **2. Administration quotidienne** | Tableau produits avec édition en ligne (prix, promo, dispo, catégorie, statuts), ajout, duplication, archivage, actions groupées (« mettre 20 produits en promo »), catégories et marques en glisser-déposer, paramètres | Modifier un prix en moins de 10 s ; scénario critique du §59 |
| **3. Photos** | Médiathèque, envoi avec recadrage carré et compression automatique, remplacement, réutilisation | Une photo envoyée depuis un téléphone apparaît optimisée dans le catalogue |
| **4. Import / export** | Modèle CSV/Excel téléchargeable, import avec prévisualisation et rapport d'erreurs ligne par ligne, mise à jour par référence, export CSV/Excel | Importer 100 produits, modifier 20 prix dans Excel, réimporter |
| **5. Données** | Produits de démonstration fictifs marqués « Exemple » ; puis script d'extraction des packshots et fiches des catalogues Impex, et import de **vos** produits et prix | Le catalogue montre vos produits réels |
| **6. Sorties** | Export PDF du catalogue depuis la base, QR code vers `/catalogue` (PNG et SVG imprimables), historique des prix, corbeille et restauration | Changer un prix puis regénérer le PDF sans rien refaire à la main |
| **7. Recette** | Playwright à 375, 768, 1024 et 1440 px ; accessibilité (clavier, contrastes, alt) ; Lighthouse mobile ; revue UX/UI finale | Rapport de tests et captures d'écran |

Objectifs de performance (mobile 4G) : page catalogue sous 150 Ko hors images,
LCP < 2 s, images en WebP chargées à la demande.

---

## 9. Décisions à prendre avant de coder

| # | Question | Pourquoi elle compte |
|---|---|---|
| **D1** | Pouvez-vous joindre le **catalogue produits secs 2025** ? | La moitié de l'analyse et des photos en dépend |
| **D2** | L'épicerie s'appelle-t-elle **Barrio Latino** (même logo, même identité que le restaurant) ou a-t-elle son propre nom ? | Détermine logo, couleurs, polices et domaine |
| **D3** | Vendez-vous **à l'unité aux particuliers**, ou aussi **au carton** (restaurants, professionnels) ? | Change l'affichage du prix et du conditionnement : un client particulier n'a pas besoin du « carton de 24 » |
| **D4** | Accord pour créer des comptes gratuits **Supabase** et **Vercel**, et pour un sous-domaine du type `epicerie.barriolatino.fr` ? | Hébergement de la base, des photos et de l'admin |
| **D5** | Photos : les packshots Impex appartiennent à Impex et aux marques. Un simple e-mail à Impex demandant l'autorisation et, si possible, les fichiers haute définition règle la question juridique et le problème de netteté. Le ferez-vous ? | Droit d'usage + qualité d'image |
