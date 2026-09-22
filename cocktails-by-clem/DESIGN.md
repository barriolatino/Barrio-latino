# Design — Cocktails by Clem

<!-- Écrit à la fin du build, à partir du site réellement construit. -->

Le monde visuel est relevé sur les publications du compte `@cocktailsbyclem_`, pas
inventé : les couleurs sont échantillonnées sur les images, la typographie reprend la
façon dont les visuels composent leurs titres, et les sept verres aquarellés sont
découpés de la publication « Carte des cocktails ».

## Thèse

La page est **une carte de cocktails imprimée**, pas une landing page de prestataire
événementiel. Elle refuse la grille de cartes arrondies identiques, le bandeau tropical
générique et le tableau de tarifs. Services, événements, coordonnées : tout est composé
en entrées de carte, filets et points de conduite.

## Couleurs

Échantillonnées sur les publications ; le pourcentage indique la source.

| Jeton | Valeur | Rôle |
|---|---|---|
| `--greige` | `#D9CFC2` | fond chaud des sections calmes |
| `--lemon` | `#E2E2C0` | fond de la carte des cocktails, plaques d'illustration |
| `--sage` | `#B8B99C` | panneaux (Clem, tarifs, façade de carte) |
| `--sage-pale` | `#DBDBCF` | capsules, surfaces d'attente |
| `--cream` | `#F4F1E6` | papier, sections denses |
| `--sun` | `#FADF70` | **marque uniquement** : filets, capsules, pictogrammes sur fond sombre |
| `--forest` | `#1B3B24` | fonds sombres, encre d'affichage |
| `--forest-deep` | `#132A19` | pied de page |
| `--ink` | `#202417` | texte courant |
| `--ink-2` | `#4A5240` | secondaire sur clair — 7,1:1 sur crème |
| `--ink-sage` | `#363D2E` | secondaire sur sauge — 5,5:1 |
| `--ember` | `#B9491C` | **action principale, et rien d'autre** |
| `--on-dark` | `#EDE8D8` | texte sur forest — 10,5:1 |
| `--on-dark-2` | `#B6C3AC` | secondaire sur forest — 6,8:1 |

Deux règles tiennent tout le système :

1. **Le jaune ne porte jamais de texte sur fond clair.** Il n'atteint que 1,6:1 sur le
   crème. Il sert de filet, de capsule et de pictogramme sur fond sombre. Pour du texte
   jaune sur clair, il faudrait `#7A6208`.
2. **L'ember est réservé à l'action.** Boutons primaires, pictogrammes de la section
   expérience, curseur de saisie, anneau de focus. L'œil apprend que l'orange veut dire
   « démarrer une conversation ».

## Typographie

Deux familles, auto-hébergées, sous-ensembles latin et latin-ext.

- **Cormorant Garamond** — affichage. Toujours en capitales, graisse 300, interlettrage
  large (`.055em` à `.11em`) : c'est exactement la façon dont « MES SERVICES » et
  « CARTE DES COCKTAILS » sont composés sur le compte. Son **italique 400** compose les
  recettes de cocktails, comme sur la carte d'origine.
- **DM Sans** — tout ce qu'une main touche : texte courant, boutons, navigation, champs,
  libellés. Graisses 400 et 500 seulement.

Échelle : `.d1` `clamp(2.55rem, 10.5vw, 5.6rem)` · `.d2` `clamp(1.85rem, 5.6vw, 3.3rem)` ·
`.d3` `clamp(1.15rem, 3vw, 1.5rem)`. Texte courant `clamp(1rem, .96rem + .2vw, 1.075rem)`,
mesure plafonnée à 66 caractères. Plancher de 11 px pour tout texte fonctionnel.

## Composants

- **Le filet qui se trace** (`.rule`) — unique moment animé de la page. `scaleX` de 0 à 1
  depuis la gauche, sortie exponentielle `cubic-bezier(.16,1,.3,1)` sur 1,05 s. Jaune en
  tête de section, encre discrète sur les fonds clairs denses.
- **L'entrée de carte** (`.entry`) — nom, points de conduite extensibles, valeur. Utilisée
  pour les coordonnées. C'est le geste emprunté à l'imprimé qui tient l'identité.
- **Les panneaux** — rayon 22 px, généreux comme sur les visuels du compte. Aucun cadre
  de carte façon kit d'interface, aucune ombre portée sur le contenu.
- **Les ombres de feuillage** (`assets/leaves.svg`) — la matière signature du compte. Le
  flou est cuit dans le SVG (`feGaussianBlur`) pour qu'aucun filtre CSS ne soit recalculé
  au défilement. Taille fixe de 1400 px, jamais `cover` : étiré sur une grande section, le
  motif donnait des taches au lieu de feuilles.
- **Le cartel de galerie** (`.gal__cap`) — chaque vignette porte son nom sous l'image,
  en petites capitales interlettrées sur le crème de la section. La vignette est une
  colonne flex dont l'image absorbe la hauteur restante, si bien que le cartel n'altère
  pas la hauteur de rangée ni le calcul des cases.
- **Les pictogrammes** — SVG dessinés, un seul trait à 1,5, réunis en `<symbol>` et
  appelés par `<use>`. Aucun emoji ne tient lieu de pictogramme.
- **L'élévation** — un décalage et un flou doux, en gris neutre. Une ombre teintée sur
  fond sombre lit comme un halo décoratif.

## Mouvement

Un seul geste orchestré, pas des effets dispersés :

- le filet se trace en tête de chaque section ;
- les blocs apparaissent avec `opacity` + `translateY` + `blur(5px)` levé, décalage de
  65 ms par enfant ;
- parallaxe très légère (0,05 à 0,14) sur le fond du hero, la marque citron et les
  feuillages — uniquement au pointeur fin, via `requestAnimationFrame` ;
- l'état par défaut est **visible** : les états masqués n'existent que si la classe `js`
  est posée, donc la page reste lisible sans JavaScript.

`prefers-reduced-motion: reduce` neutralise tout, filets inclus.

## Surfaces du navigateur

Elles portent aussi l'identité : sélection jaune sur forest, curseur de saisie ember,
barre de défilement sauge sur greige, anneau de focus ember (jaune sur les fonds
sombres), soulignement des liens en jaune avec `text-underline-offset: .22em`,
`font-variant-numeric: tabular-nums` sur les chiffres.

## Rythme des sections

Alternance voulue dense / calme, clair / sombre :

hero sombre → greige calme (expérience) → crème dense (prestations) → **citron, le
sommet de la page** (carte) → greige calme (Clem) → forest dense (événements) → crème
dense (galerie) → citron (Instagram) → sauge calme (tarifs) → crème fonctionnel (devis)
→ forest (contact et zone) → forest profond (pied).

## Points de rupture

`560px` (deux colonnes de formulaire, trois cocktails de front) · `860px` (navigation
déployée, menu et barre d'action mobiles retirés, galerie en grille éditoriale) ·
`1100px` (respiration de la carte). Conception mobile d'abord : le trafic vient du lien
en bio Instagram.
