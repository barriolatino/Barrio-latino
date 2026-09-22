# Site du Barrio Latino

Site vitrine du restaurant **Barrio Latino** — cuisines d'Amérique latine,
9 rue du Port, 63000 Clermont-Ferrand.

Site statique en HTML, CSS et JavaScript, sans framework et sans étape de
compilation : **ce qui est dans le dépôt est exactement ce qui est publié.**
Hébergé par GitHub Pages depuis la branche `main`, dossier racine.

<https://barriolatino.github.io/Barrio-latino/>

---

## Mode d'emploi — ce que vous pouvez modifier vous-même

Les contenus qui changent souvent sont dans **trois fichiers JSON**, séparés du
code. Vous pouvez les éditer directement depuis GitHub (bouton crayon), sans
rien installer : la modification est en ligne une à deux minutes plus tard.

> **Une seule règle à respecter dans ces fichiers :** ne supprimez jamais une
> virgule, un guillemet droit `"` ou une accolade. Recopiez toujours une ligne
> existante et remplacez seulement le texte *entre* les guillemets. Si la page
> affiche « La carte n'a pas pu être chargée », c'est qu'une ponctuation manque :
> annulez la modification dans l'historique GitHub et recommencez.

### Modifier la carte → `assets/data/menu.json`

Chaque catégorie (Entrées, Plats, Cocktails…) contient une liste `plats`.
Pour ajouter un plat, recopiez un bloc entier et changez les valeurs :

```json
{ "nom": "Anticuchos", "prix": "12 €", "description": "Brochettes de cœur de bœuf marinées.", "vege": false }
```

- `prix` est du texte libre : `"12 €"`, `"12,50 €"`, `"à partir de 12 €"`…
- `"photo": "nom-du-fichier"` affiche une vignette à côté du plat. Le fichier
  doit exister dans `assets/img/plats/vignettes/` **en `.webp` et en `.jpg`**,
  au format 4:3 (232 × 174 px). Sans cette clé, la ligne s'affiche simplement
  sans photo : les lignes illustrées et les autres cohabitent sans décaler la
  mise en page, vous pouvez donc en ajouter au fil de l'eau.
- `"vege": true` affiche la pastille verte **Végétarien**. Retirez la ligne si le
  plat n'est pas végétarien.
- Pour **supprimer** un plat, supprimez son bloc `{ … }` *et* la virgule qui le
  précède ou le suit.
- `note` sur une catégorie affiche une pastille turquoise à côté du titre
  (ex. « 22 € la bouteille »).
- `mention` est la petite phrase sous la carte.
- `lien_uber_eats` pilote le bouton « Commander sur Uber Eats » : il est
  renseigné et le bouton s'affiche. Videz le champ (`""`) et le bouton
  disparaît — pratique si vous suspendez la livraison.

### Modifier les avis → `assets/data/avis.json`

- `note` et `nombre` alimentent le gros « 4,8/5 », la mention « 287 avis » **et**
  les données structurées lues par Google. Pensez à les mettre à jour ensemble.
- Chaque avis : `auteur` (prénom + initiale), `texte` (sans les guillemets, ils
  sont ajoutés automatiquement), `etoiles` de 1 à 5, et `"local_guide": true`
  pour afficher le badge.
- Le carrousel s'adapte tout seul au nombre d'avis.

### Modifier les événements → `assets/data/evenements.json`

- `prochain` est le grand encart bleu nuit en haut de la section. Remplissez
  `titre`, `date` (texte libre : `"samedi 14 février"`) et `description`.
  **Laissez `titre` vide pour faire disparaître l'encart** quand rien n'est prévu.
- `recurrents` est la liste des cartes en dessous (Fiesta Latina, karaoké…).

### Modifier les horaires

Les horaires apparaissent à **trois endroits** qu'il faut changer ensemble :

1. `index.html`, section « Infos pratiques » : le tableau `<dl class="hours">`.
   Une ligne par jour, `data-dow` va de `0` (dimanche) à `6` (samedi) — ne le
   touchez pas, c'est lui qui met le jour en cours en surbrillance.
2. `index.html`, le pied de page (bloc « Horaires ») et les données structurées
   `openingHoursSpecification` tout en bas du fichier.
3. `assets/js/main.js`, constante `SERVICES` (~ligne 150). C'est elle qui calcule
   l'indicateur « Ouvert maintenant / Fermé » à l'heure de Paris. Les horaires
   y sont en **minutes depuis minuit** : `12h30 = 750`, `15h00 = 900`,
   `19h00 = 1140`, `22h00 = 1320`.

Les jours ouverts du **calendrier de réservation** se règlent dans le même
fichier, constante `OUVERTS` (`[3, 4, 5, 6]` = mercredi à samedi).

### Remplacer ou ajouter une photo

Chaque photo existe en deux formats : un `.webp` (servi en priorité, plus léger)
et un `.jpg` (secours pour les vieux navigateurs). **Il faut remplacer les deux**,
en gardant exactement le même nom de fichier — le code n'a alors pas à changer.

Un script fait la conversion pour vous :

```bash
./outils/optimiser-image.sh ~/mes-photos/ceviche.jpg plats/ceviche
```

Il crée `assets/img/plats/ceviche.webp` et `assets/img/plats/ceviche.jpg`.

Pour qu'un nouveau plat apparaisse aussi **en vignette dans la carte**, il faut
en plus une version 4:3 de 232 × 174 px dans `assets/img/plats/vignettes/`,
puis ajouter `"photo": "ceviche"` au plat dans `menu.json`.
Dépendances : `webp` et `libjpeg-turbo-progs` (sur macOS :
`brew install webp jpeg-turbo`).

Si vous remplacez une photo par une autre **de dimensions différentes**, mettez à
jour ses attributs `width` et `height` dans `index.html` : ils réservent la place
de l'image avant son chargement et évitent que la page saute.

Écrivez toujours un `alt` qui décrit la photo en français — c'est ce que lisent
les personnes aveugles et Google.

Les galeries sont pilotées par l'attribut `data-galerie` : toutes les
vignettes d'un même conteneur forment un groupe, et les flèches de
l'affichage plein écran restent à l'intérieur de ce groupe. Il y en a deux,
la galerie photos et la galerie traiteur.

`assets/img/clients/amies-dejeuner` n'est plus affichée mais reste
disponible : il suffit de recopier un bloc `<button class="shot">` de la
galerie pour la remettre.

Les originaux haute résolution sont rangés dans `assets/img/_sources/` et ne
sont jamais chargés par le site. Les photos de plats y figurent sous deux
formes : le fichier d'origine tel qu'il a été fourni, suffixé
`-avec-badge`, et la version publiée dont le badge Uber Eats du coin
inférieur droit a été retiré — le fond a été reconstitué, aucun plat n'était
recouvert.

---

## Organisation des fichiers

```
index.html                    la page entière (structure + contenus fixes)
mentions-legales.html         mentions légales
robots.txt · sitemap.xml      référencement
.nojekyll                     indique à GitHub de publier les fichiers tels quels

assets/css/style.css          tous les styles
assets/css/fonts.css          déclarations des polices auto-hébergées
assets/js/main.js             toutes les interactions
assets/fonts/                 polices en WOFF2 (Fraunces, Plus Jakarta Sans, Pacifico)
assets/data/menu.json         la carte
assets/data/avis.json         les avis Google
assets/data/evenements.json   les événements
assets/img/logo/              logo, icônes, image de partage
assets/img/salle/             la salle et la devanture
assets/img/plats/             les plats en grand format
assets/img/plats/vignettes/   les mêmes en 4:3 pour la carte
assets/img/clients/           les clients et les soirées
assets/img/traiteur/          les photos d'événements traiteur
assets/img/presse/            la coupure de La Montagne
assets/img/_sources/          originaux haute résolution (non publiés)

outils/optimiser-image.sh     conversion d'une photo en WebP + JPG
```

## Choix techniques

- **Aucune image en base64.** Chaque photo est un fichier séparé, donc mise en
  cache par le navigateur d'une visite à l'autre.
- **Polices auto-hébergées** : aucune requête vers Google Fonts, ce qui supprime
  une dépendance tierce bloquante et toute question de confidentialité. Pacifico
  est réduite aux 20 caractères de la citation du néon (8 ko au lieu de 32).
- **Le formulaire de réservation n'envoie rien à un serveur.** Il met la demande
  en forme et l'ouvre dans WhatsApp ou dans le logiciel de messagerie du
  visiteur. Aucune donnée ne transite par le site, d'où l'absence de bandeau
  cookies.
- **Aucun cookie, aucune mesure d'audience.** Le seul tiers appelé est Google
  Maps, et seulement quand le visiteur fait défiler la page jusqu'au plan.
- **Accessibilité** : navigation complète au clavier, contrastes conformes
  WCAG AA sur l'ensemble des textes, `prefers-reduced-motion` respecté,
  carrousel et calendrier pilotables au clavier.

## Publication

Tout `push` sur `main` déclenche la mise en ligne (une à deux minutes).
Réglage dans **Settings → Pages** : source `main`, dossier `/ (root)`.

Le site est publié dans un sous-dossier (`/Barrio-latino/`), donc **tous les
chemins doivent rester relatifs** (`assets/img/...` et non `/assets/img/...`).

## Vérifier avant de publier

```bash
python3 -m http.server 8099     # puis ouvrir http://localhost:8099
python3 -c "import json;[json.load(open(f'assets/data/{n}.json')) for n in ('menu','avis','evenements')];print('JSON valides')"
```
