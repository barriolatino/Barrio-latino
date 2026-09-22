# Barrio Latino — site vitrine

Restaurant latino-américain à Clermont-Ferrand. Site statique publié par
GitHub Pages sur la branche `main`, dossier racine, à l'adresse
`https://barriolatino.github.io/Barrio-latino/`.

## Architecture

Site multi-fichiers sans framework ni étape de compilation : ce qui est dans le
dépôt est exactement ce qui est servi.

- `index.html` : la page unique. Contenus fixes, ornements SVG en ligne,
  données structurées JSON-LD.
- `assets/css/style.css` : tous les styles. `assets/css/fonts.css` : les
  `@font-face` des polices auto-hébergées.
- `assets/js/main.js` : toutes les interactions, en un seul IIFE sans
  dépendance.
- `assets/data/{menu,avis,evenements}.json` : les contenus que le
  propriétaire édite lui-même, chargés en `fetch` au runtime.
- `outils/optimiser-image.sh` : conversion d'une photo en WebP + JPG.

## Contraintes à ne pas casser

- **Chemins relatifs uniquement** (`assets/img/...`). Le site vit dans le
  sous-dossier `/Barrio-latino/` : un chemin absolu casse tout.
- **Jamais d'image en base64** dans le HTML. Une version antérieure du site
  embarquait 1,71 Mo d'images encodées, soit 97 % du poids de la page, sans
  mise en cache possible. Toute nouvelle image passe par
  `outils/optimiser-image.sh` et arrive en WebP + JPG de secours dans
  `assets/img/`.
- **Le trafic vient du lien en bio Instagram**, donc du mobile : le poids de la
  page est le premier critère de qualité. Référence à tenir : 384 ko et 14
  requêtes au premier affichage mobile, CLS 0.
- **Toute couleur portant du texte blanc** doit utiliser une variante « deep »
  (`--coral-deep`, `--turquoise-deep`, `--sun-deep`). Les teintes de marque
  brutes n'atteignent pas le ratio WCAG AA 4.5:1 sur fond clair. Elles passent
  en revanche sur le bleu nuit.
- **`[hidden]` est déclaré `!important`** dans `style.css` : plusieurs
  composants portent `display:flex` ou `display:grid`, qui l'emporterait
  sinon et laisserait visible un élément masqué par le JS.
- **Les horaires sont écrits à trois endroits** qu'il faut modifier ensemble :
  le tableau `<dl class="hours">`, le JSON-LD `openingHoursSpecification` et
  la constante `SERVICES` de `main.js` (minutes depuis minuit).

## Reste à compléter par le propriétaire

- **Médiateur de la consommation** : dernier `<span class="todo">` de
  `mentions-legales.html`. Tout le reste des informations légales est renseigné.
- **Photos manquantes** : la salle sans personne et la devanture restent en
  basse résolution ; les desserts, le ceviche, les tequeños, les patacones et
  la bandeja n'ont pas de photo. Huit plats sur trente-six sont illustrés.

Déjà réglés : lien Uber Eats, stationnement, accessibilité (dérogation),
identité légale (PELISSIER ARANIBAR, SARL, SIREN 989 353 354, cogérance).

## Vignettes de la carte

Un plat de `menu.json` portant une clé `photo` affiche une vignette 4:3
(232 × 174 px) lue dans `assets/img/plats/vignettes/`. Les lignes sans photo
gardent une grille à deux colonnes, celles avec photo passent à trois : le
prix reste calé à droite dans les deux cas, donc **aucune case vide ne troue
la liste** et la couverture peut rester partielle sans que cela se voie. Les
vignettes portent `alt=""` : le nom du plat est juste à côté, une description
d'image ferait doublon pour un lecteur d'écran.

## Photos de plats et badge Uber Eats

Les photos de plats ont été fournies avec un badge Uber Eats incrusté en bas
à droite. Il a été retiré en reconstituant le fond par ajustement polynomial
sur les pixels propres voisins — aucun plat n'était recouvert, la vérification
est faite avant chaque retrait. Les fichiers d'origine avec badge sont
conservés dans `assets/img/_sources/*-avec-badge.jpg`. Ces photos ayant été
produites dans le cadre de l'inscription à Uber Eats, leurs droits
d'utilisation hors de la plateforme sont à confirmer par le propriétaire.

## Outillage Claude Code

Les 5 outils sont déclarés dans `.claude/settings.json`. Pour les réinstaller
dans une nouvelle session cloud : `bash setup-claude-toolchain.sh`.

Arbitrage entre outils qui réclament la priorité en début de session :

1. **superpowers** est injecté automatiquement ; ses skills de processus
   (`brainstorming`, `systematic-debugging`) passent avant l'implémentation.
2. **task-observer** seulement pour une tâche réellement multi-étapes
   (~15k tokens par invocation) — jamais pour une question simple.
3. **impeccable** prend la main sur tout travail de design frontend.

`claude-mem` fonctionne uniquement par hooks et ne s'invoque pas manuellement.
