# Production — publicité « Mercredi tacos 3 € »

## Fichiers livrés (`video/dist/`)

| Fichier | Usage | Caractéristiques |
|---|---|---|
| `barrio-latino-mercredi-tacos-3-euros.mp4` | master, archive, montage | 1080 × 1920, 30 i/s, 30,000 s (900 images), H.264 High 4.2 CRF 15 (~15 Mb/s), AAC 256 kb/s |
| `barrio-latino-mercredi-tacos-3-euros-instagram-tiktok.mp4` | **à publier** sur Reels, TikTok, Stories | H.264 High 4.1, débit plafonné à 8 Mb/s, une image clé par seconde, AAC 192 kb/s 48 kHz, -14 LUFS, *faststart*, BT.709 |
| `barrio-latino-mercredi-tacos-cover.jpg` | miniature (couverture du Reel) | 1080 × 1920, écran final : 3 €, mercredi, Barrio Latino, adresse. Lisible dans les recadrages 4:5 et 3:4 de la grille du profil |
| `qa/planche-contact.jpg` | relecture rapide | une image par seconde |

## Relancer la génération

Prérequis : Node.js 20 ou plus récent. FFmpeg et ffprobe sont installés par npm,
il n'y a rien à installer à la main.

```bash
cd video
npm install            # Playwright, FFmpeg statique, polices Baloo 2 et Work Sans
npx playwright install chromium   # une seule fois, si Chromium n'est pas déjà présent
npm run render         # environ 4 min : bande son, 900 images, master, version sociale, miniature
npm run check          # contrôle qualité (durée, format, loudness, textes, zones de sécurité)
```

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm run render -- --preview` | brouillon rapide à 15 i/s (environ 1 min), sans version sociale |
| `npm run audio` | ne régénère que la bande son (`.cache/soundtrack.wav`) |
| `node scripts/stills.mjs 2 10 29.5 --safe` | images fixes à des instants précis, avec le calque des zones d'interface |

Pour voir la scène en direct, ouvrir `video/scene/index.html` dans Chrome après un
premier rendu (les images préparées sont dans `.cache/`), puis lancer
`renderFrame(12)` dans la console. Ajouter `?safe` à l'adresse affiche les zones de
sécurité.

## Changer la photo héro

La photo héro est `video/source/hero.jpg`. Sans ce fichier, le rendu se rabat sur
`assets/04-tacos-mexicains-maison.jpg`. Pour une autre photo :

1. La déposer dans `video/source/hero.jpg`, ou la passer avec `npm run render -- --photo chemin/photo.jpg`.
2. Si besoin, la rogner avec `--crop x,y,l,h` (fractions de l'image, par exemple `0,0,1,0.9`).
3. Mettre à jour les points de cadrage dans `video/scene/timeline.js` (tableau
   `camera` et tableau d'aide en tête du fichier) : `(cx, cy)` est le point de la photo
   placé au centre de la fenêtre, `zoom` le grossissement.
4. Vérifier avec `node scripts/stills.mjs 6 13 17 21 22.5 24 25.5 29.5`, puis lancer `npm run render`.

## Ajouter une voix off

Déposer l'enregistrement dans `video/source/voiceover.wav` (ou `.mp3` / `.m4a`),
calé sur les fenêtres du storyboard (§ 5), puis relancer `npm run render`. La musique
baisse automatiquement sous la voix (compression en sidechain), puis l'ensemble est
normalisé à -14 LUFS.

## Modifier un texte, un timing ou un cadrage

Tout se trouve dans **`video/scene/timeline.js`** :

- `texts` : texte, instant d'entrée et de sortie, position verticale `y`, style.
  Une ligne trop longue est réduite automatiquement pour tenir en largeur.
- `camera` : images clés de la caméra dans la photo.
- `frames`, `frameMoves`, `panelMoves` : taille de la fenêtre photo et du panneau crème.
- `sfx` : instants des whoosh, de la montée et des impacts (lus par la bande son).

Garder les temps forts sur la grille de 0,15 s (double-croche à 100 BPM) pour que les
impacts tombent en rythme. Après chaque modification, `npm run check` confirme que
les textes restent dans la zone utile.

## Architecture

```
video/
├── scene/
│   ├── index.html     mise en page, styles, palette, typographies
│   ├── scene.js       moteur : renderFrame(t) place tout pour l'instant t (déterministe)
│   └── timeline.js    textes, timings, cadrages, repères son ← fichier à éditer
├── scripts/
│   ├── prepare.mjs    photo : rognage, agrandissement Lanczos + accentuation, fond flou
│   ├── audio.mjs      synthèse de la musique et des effets, mixage de la voix, -14 LUFS
│   ├── render.mjs     3 Chromium en parallèle → PNG → FFmpeg (master, version sociale, miniature)
│   ├── check.mjs      contrôle qualité automatisé
│   └── stills.mjs     images fixes de relecture
├── source/            photo HD et voix off facultatives (entrées de l'utilisateur)
├── dist/              fichiers livrés
└── .cache/            fichiers intermédiaires (non versionnés)
```

Choix techniques : HTML/CSS dans Chromium pour une typographie nette (vraies
polices, crénage, emoji), Playwright pour capturer chaque image, FFmpeg pour
l'encodage. Il n'existait aucun outil vidéo dans le projet : cette pile réutilise
Node et Playwright, déjà présents, et les polices du site.

## Publication

- **Instagram Reels** : publier la version `-instagram-tiktok.mp4` et choisir
  `barrio-latino-mercredi-tacos-cover.jpg` comme couverture. Dans la légende, mettre
  l'adresse et le téléphone (09 81 92 40 25) et le lien du site en bio
  (https://barriolatino.github.io/Barrio-latino/).
- **TikTok** : même fichier ; la couverture peut être choisie à 28–29 s dans la vidéo.
- **Stories** : même fichier ; ajouter un sticker lien vers le site en bas, dans la
  zone laissée libre (y > 1480).

## Contrôle qualité (résultat de `npm run check`)

- [x] Durée exacte : 30,000 s, 900 images
- [x] 1080 × 1920, ratio 9:16, 30 i/s
- [x] Photo de référence (planche, Valentina) utilisée comme visuel héro, sans déformation ni retouche de forme
- [x] « 3 € » révélé à 9,6 s, élément dominant, rouge sur crème ; visible en pastille dès 2,4 s
- [x] « TOUS LES MERCREDIS », « TORTILLAS DE TACOS », « BARRIO LATINO » présents et lisibles
- [x] Adresse exacte : 9 rue du Port, 63000 Clermont-Ferrand
- [x] Aucun texte coupé, tous dans la zone utile (mesure automatique)
- [x] Loudness -14 LUFS, crête -1,5 dBTP
- [x] Écran final complet affiché 1,8 s, informations clés visibles 3 s
- [ ] Voix off : non produite (pas de moteur de synthèse vocale disponible) ; la vidéo fonctionne sans le son
