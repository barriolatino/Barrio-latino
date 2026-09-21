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
├── favicon.svg  robots.txt  sitemap.xml  .nojekyll
├── PRODUCT.md   DESIGN.md  vérité produit et système visuel
└── assets/
    ├── fonts.css + fonts/          Cormorant Garamond + DM Sans, auto-hébergées
    ├── leaves.svg                  ombres de feuillage (motif signature)
    ├── og-image.jpg                image de partage 1200×630
    ├── cocktail-margarita.jpg      photo — hero, prestations, galerie
    ├── clem.jpg                    portrait — section « Qui est Clem ? » et galerie
    ├── dosage-alcool.jpg           photo — prestation « Barman privé », galerie
    ├── dosage-citron.jpg           photo — prestation « Sur mesure », galerie
    ├── barman-prepare.jpg          photo — section expérience et galerie
    ├── insta-*.jpg                 3 publications, aperçu du feed
    └── cocktails/*.jpg             7 illustrations extraites de votre carte
```

## Mettre en ligne

Le site a été préparé pour vivre dans **son propre dépôt**, séparé de Barrio Latino.

```bash
# 1. Créer un dépôt vide « cocktails-by-clem » sur GitHub, puis :
cd cocktails-by-clem
git init && git add -A
git commit -m "Site Cocktails by Clem"
git branch -M main
git remote add origin https://github.com/<votre-compte>/cocktails-by-clem.git
git push -u origin main

# 2. Sur GitHub : Settings → Pages → Source = branche main, dossier / (root).
```

Le site est alors en ligne sur `https://<votre-compte>.github.io/cocktails-by-clem/`.
Pour un vrai nom de domaine (recommandé) : ajoutez un fichier `CNAME` contenant votre
domaine et pointez-le vers GitHub Pages chez votre registrar.

**Après avoir choisi l'adresse définitive**, remplacez `cocktails-by-clem.example`
partout :

```bash
grep -rl "cocktailsbyclem.example" . | xargs sed -i 's|cocktailsbyclem.example|votre-domaine.fr|g'
```

Cela corrige l'URL canonique, l'Open Graph, les données structurées, `robots.txt` et
`sitemap.xml` en une fois.

## ⚠️ Ce qu'il reste à renseigner

Rien n'a été inventé. Chaque information manquante est un emplacement explicite dans le
code, repérable avec `grep -rn "À COMPLÉTER" .` :

| Où | Quoi |
|---|---|
| `index.html` (3×) | URL définitive du site · adresse email · lien des avis Google |
| `mentions-legales.html` (8×) | nom de l'éditeur, statut juridique, adresse, SIRET, TVA, directeur de publication, hébergeur |
| `confidentialite.html` (3×) | responsable de traitement, email de contact pour les droits RGPD |
| carte des cocktails | la recette du **Mara Sour** (absente de votre carte Instagram) |

Pour activer le bouton « Envoyer un email » une fois l'adresse connue, remplacez dans
`index.html` le `<span class="btn btn-ghost" aria-disabled="true">` par un
`<a class="btn btn-ghost" href="mailto:votre@email.fr">`.

## Ajouter vos photos

Déposez vos fichiers dans `assets/` et référencez-les dans `index.html`. Il reste deux
endroits qui gagneraient à recevoir de vraies photos d'événements :

1. **Les prestations** — trois des six panneaux (Mariages, Anniversaires, Événements
   professionnels) montrent encore une illustration de cocktail, faute de photo prise en
   événement. Les chemins sont dans `main.js`, tableau `SERVICES`. Une photo de vin
   d'honneur ou de bar installé en salle vaudrait beaucoup ici.
2. **La galerie** — 5 photos et 3 illustrations aujourd'hui. Pour convertir une cellule
   d'illustration en photo, retirez `frame--art` de sa `<div>` : l'image remplira la case
   au lieu d'être contenue sur fond citron.

Format conseillé : JPEG, 1200 px de large maximum, qualité 80. Une photo absente
n'affiche jamais d'icône cassée : `main.js` la remplace par un emplacement nommé.

## Brancher les avis Google

Aucun témoignage n'a été inventé ; la section affiche un emplacement honnête.

1. Créez la fiche **Google Business Profile** de Cocktails by Clem (catégorie
   « Service de bar » ou « Traiteur »).
2. Récupérez le lien « Rédiger un avis » / la page d'avis de la fiche, et remplacez le
   `href` du bouton « Voir les avis Google » dans `index.html`.
3. Pour afficher les avis **dans la page**, il faut la *Places API* : créez un projet
   Google Cloud, activez « Places API », créez une clé restreinte à votre domaine, puis
   appelez `place/details` avec le `place_id` de la fiche et le champ `reviews`.
   Attention : Google n'en renvoie que 5, et ses conditions imposent d'afficher
   l'attribution et la photo de l'auteur. Tant que la fiche n'existe pas, il n'y a rien
   à brancher.

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
