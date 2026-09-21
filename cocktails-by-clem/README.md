# Cocktails by Clem — site vitrine

Site statique d'une seule page pour **Cocktails by Clem**, barman privé et cocktails
événementiels à Clermont-Ferrand. Aucune étape de build : les fichiers sont servis tels
quels.

```
cocktails-by-clem/
├── index.html              page unique (toutes les sections)
├── styles.css              système de design complet
├── main.js                 comportements (menu, accordéon, formulaire, carte)
├── mentions-legales.html   ⚠️ champs légaux à compléter
├── confidentialite.html    ⚠️ responsable de traitement à compléter
├── favicon.svg  robots.txt  .nojekyll
├── PRODUCT.md   DESIGN.md  vérité produit et système visuel
└── assets/
    ├── fonts.css + fonts/          Cormorant Garamond + DM Sans, auto-hébergées
    ├── leaves.svg                  ombres de feuillage (motif signature)
    ├── og-image.jpg                image de partage 1200×630
    ├── cocktail-margarita.jpg      photo — hero, prestations, galerie
    ├── clem.jpg                    portrait — section « Qui est Clem ? » et galerie
    ├── evenement-vin-honneur.jpg   photo — prestation « Mariages », tête de galerie
    ├── buffet-evenement.jpg        photo — prestation « Anniversaires », galerie
    ├── buffet-canapes.jpg          photo — prestation « Événements pro », galerie
    ├── pisco-sour-service.jpg      photo — prestation « Atelier cocktail », galerie
    ├── dosage-alcool.jpg           photo — prestation « Barman privé », galerie
    ├── dosage-citron.jpg           photo — prestation « Sur mesure », galerie
    ├── barman-prepare.jpg          photo — section expérience et galerie
    ├── insta-*.jpg                 3 publications, aperçu du feed
    └── cocktails/*.jpg             7 illustrations extraites de votre carte
```

## Mettre en ligne

Le site est prêt à être publié : il contient déjà le workflow
`.github/workflows/pages.yml`, qui **active GitHub Pages tout seul** au premier push.
Aucun passage par Settings n'est nécessaire.

Il ne manque qu'une chose que l'automatisation ne peut pas faire : **créer le dépôt**.
L'application Claude installée sur ce compte n'a pas le droit « Administration », donc
la création passe forcément par vous.

### 1. Créer le dépôt (30 secondes, sans ligne de commande)

Sur <https://github.com/new> :

- **Repository name** : `cocktails-by-clem`
- **Public** (GitHub Pages est payant sur un dépôt privé)
- **Ne cochez rien** : ni README, ni .gitignore, ni licence. Le dépôt doit rester vide.

### 2. Y envoyer le site

Deux façons, au choix.

**Si vous préférez que je m'en charge** — donnez au passage à l'application Claude
l'accès à ce nouveau dépôt sur
<https://github.com/apps/claude/installations/select_target>, puis dites-le moi : je
pousse le site et le workflow fait le reste.

**Si vous le faites vous-même**, depuis un terminal :

```bash
git clone --branch claude/cocktails-clem-website-gyk6cm \
  https://github.com/barriolatino/Barrio-latino.git tmp-clem
cd tmp-clem/cocktails-by-clem
rm -rf ../.git                      # on détache le dossier de son dépôt d'origine
git init && git add -A
git commit -m "Site Cocktails by Clem"
git branch -M main
git remote add origin https://github.com/barriolatino/cocktails-by-clem.git
git push -u origin main
```

### 3. Vérifier

Une à deux minutes après le push, l'onglet **Actions** du dépôt doit afficher un
« Déploiement GitHub Pages » en vert, et le site répondre sur :

**<https://barriolatino.github.io/cocktails-by-clem/>**

Si l'onglet Actions montre une erreur de permission sur `configure-pages`, c'est que le
compte restreint les droits des workflows : allez dans **Settings → Actions → General →
Workflow permissions**, choisissez **Read and write permissions**, puis relancez le
workflow. C'est le seul cas où un réglage manuel reste nécessaire.

### Plus tard : un nom de domaine

Ajoutez un fichier `CNAME` contenant votre domaine à la racine du dépôt, et pointez-le
vers GitHub Pages chez votre registrar. Pensez alors aux trois balises absolues
mentionnées plus bas.

## Ce qui est renseigné

Toutes les informations du site sont désormais réelles : aucun emplacement
« À COMPLÉTER » ne subsiste. `grep -rn "À COMPLÉTER" .` ne renvoie rien.

Rien n'a été inventé en chemin. Les tarifs (5 € et 6 € par cocktail, 30 € par personne
pour l'atelier) viennent de vos publications et de vos messages ; le Mara Sour et la
Caïpirinha ont été retirés à votre demande plutôt que complétés au jugé ; et les champs
sans objet — statut juridique, SIRET, TVA — ont été supprimés des mentions légales
plutôt que laissés vides.

Deux points restent optionnels, non bloquants :

- **Un nom de domaine.** Le site fonctionne sans, mais certains réseaux sociaux exigent
  une URL absolue pour afficher l'image de partage (voir *Mettre en ligne* ci-dessus).
- **Une fiche Google Business**, si vous voulez afficher des avis un jour
  (voir *Ajouter des avis plus tard*).

## Ajouter vos photos

Les **sept prestations montrent désormais une vraie photo** ; plus aucune illustration ne
tient lieu de visuel d'événement. La galerie compte 9 photos et 2 illustrations, chacune
portant son nom en cartel sous l'image — les cocktails ouvrent la série.

Pour en ajouter : déposez le fichier dans `assets/`, puis ajoutez une entrée au bloc
`.gal` de `index.html`, ou changez un chemin dans `main.js`, tableau `SERVICES`. Format
conseillé : JPEG, 1000 px de large, qualité 80.

**La grille de la galerie se remplit par multiples de trois.** La 1ʳᵉ entrée occupe
2×2 cases et la 2ᵉ 1×2, soit 6 cases ; chaque entrée suivante en occupe une. Avec
11 entrées on tombe juste sur 5 rangées pleines. Pour garder une grille sans trou,
ajoutez ou retirez les photos **trois par trois**.

### Droit à l'image

Deux photos d'événement montrent des invités reconnaissables. Le propriétaire a confirmé
disposer des accords nécessaires à leur publication. Pour toute nouvelle photo
d'événement, la même vérification s'impose avant mise en ligne.

Format conseillé : JPEG, 1200 px de large maximum, qualité 80. Une photo absente
n'affiche jamais d'icône cassée : `main.js` la remplace par un emplacement nommé.

## Ajouter des avis plus tard

La section « Ils ont vécu l'expérience » a été retirée : sans fiche Google Business, elle
n'affichait qu'un emplacement vide et un bouton qui ne menait nulle part. Le jour où des
avis existent, deux chemins :

- **Le plus simple** — créer la fiche **Google Business Profile** (catégorie « Service de
  bar » ou « Traiteur »), puis remettre une section avec un bouton vers sa page d'avis.
- **Les afficher dans la page** — il faut la *Places API* : un projet Google Cloud, la
  « Places API » activée, une clé restreinte au domaine, puis un appel `place/details`
  avec le `place_id` et le champ `reviews`. Google n'en renvoie que cinq et impose
  d'afficher l'attribution et la photo de l'auteur.

La section supprimée reste dans l'historique git (`git show 0a715f8:cocktails-by-clem/index.html`)
si vous voulez la reprendre telle quelle.

## Brancher le formulaire

Aujourd'hui le formulaire **n'envoie rien à un serveur** : il valide les champs, compose
un message et l'ouvre dans WhatsApp, où vous gardez la main avant d'envoyer. C'est le
canal que vous utilisez déjà, et cela évite tout stockage de données personnelles.

Pour recevoir en plus une copie par email, sans serveur :

- **Formspree** (gratuit jusqu'à 50 envois/mois) — créez un formulaire, puis dans
  `main.js`, avant l'ouverture de WhatsApp :
  ```js
  fetch('https://formspree.io/f/VOTRE_ID', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(Object.fromEntries(new FormData(form))),
  }).catch(() => {});
  ```
- **Netlify Forms** si vous hébergez sur Netlify plutôt que GitHub Pages : ajoutez
  `netlify` et `name="devis"` sur la balise `<form>`, rien d'autre.

Dans les deux cas, mettez à jour `confidentialite.html` : les données transiteront alors
par un tiers, ce que la page affirme aujourd'hui ne pas être le cas.

## Choix techniques

- **Pas de framework.** Une page vitrine dont le trafic vient du lien en bio Instagram :
  le poids prime. Chargement initial ≈ 340 Ko, dont 167 Ko de polices mises en cache dès
  la deuxième visite.
- **Polices auto-hébergées.** Aucune requête vers Google Fonts, donc aucune adresse IP
  transmise à un tiers et un rendu qui ne dépend pas d'un domaine externe.
- **Carte Google chargée sur clic.** Tant que le visiteur ne la demande pas, Google ne
  reçoit rien et aucun cookie n'est déposé.
- **Illustrations réutilisées.** Les sept verres aquarellés viennent de votre propre
  publication du 25 mars, découpés un par un. Aucune image n'a été générée.
- **Tarifs.** 6 € (signatures) et 5 € (incontournables), à partir de 30 unités, repris de
  votre publication « Mes services ». La page précise qu'ils sont à confirmer au devis.

## Accessibilité et qualité

Vérifié au navigateur en 390, 768, 1280 et 1440 px :

- contraste WCAG AA respecté sur toute la page ;
- aucun texte fonctionnel sous 11 px, aucune cible tactile sous 40 px ;
- aucun débordement horizontal ;
- navigation complète au clavier, focus visible, `Échap` ferme le menu ;
- `prefers-reduced-motion` désactive animations et parallaxe ;
- la page reste entièrement lisible sans JavaScript (seuls l'accordéon, le menu mobile
  et l'envoi du formulaire en dépendent).

## Modifier les contenus

Les listes vivent dans `main.js`, en haut du fichier : `SERVICES`, `SIGNATURES`,
`CLASSIQUES`, `EVENEMENTS`. Ajouter un cocktail = ajouter une ligne au tableau et déposer
l'image correspondante dans `assets/cocktails/`.

Les couleurs et les tailles sont regroupées dans les jetons en tête de `styles.css`
(`:root`). Voir `DESIGN.md` pour le système complet.
