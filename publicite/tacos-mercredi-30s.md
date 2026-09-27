# BARRIO LATINO — « Mercredi Tacos » · Spot 30 s · 9:16

Dossier de production complet : storyboard, prompts plan par plan, cohérence,
lumière, son, montage, déclinaisons TikTok / Reels, negative prompt, checklist.

Photo de référence produit : [`reference-tacos.png`](reference-tacos.png)

---

## 0. Avant de générer : trois décisions qui font tout le réalisme

Ces points ne sont pas négociables si l'objectif est « on dirait une agence ».

1. **Le texte ne se génère jamais dans l'IA.** Prix, adresse, nom, sous-titres :
   tout est posé au montage (CapCut, Premiere, DaVinci). Un modèle vidéo écrit
   « 3,5O€ » ou « BARRIO LATNIO » une fois sur deux. Même règle pour les
   enseignes de rue : prompts « no readable signage », floutées par la
   profondeur de champ.
2. **La façade et la salle du Barrio Latino doivent venir du vrai restaurant.**
   Aucun modèle ne sait à quoi ressemble le 9 rue du Port. Plans 11 à 14 :
   tourner 10 minutes au smartphone (4K, 24 ou 25 i/s, mode cinéma désactivé)
   ou, à défaut, animer de vraies photos en image-to-video. Un intérieur inventé
   est la façon la plus sûre de décevoir le client qui arrive mercredi.
3. **Le tacos s'anime à partir de la vraie photo.** Tous les plans produit
   partent d'une image fixe (image-to-video), jamais d'un prompt texte seul.
   Idéalement : 6 photos du vrai tacos sous plusieurs angles, en cuisine, le
   jour du tournage. C'est ce qui garantit « tortilla de maïs, pas fast-food ».

Hybride recommandé (le plus crédible pour le budget) :

| Plans | Source recommandée |
|---|---|
| Food macro (1, 7-10, 15) | Vraies photos du tacos → image-to-video, ou tournage réel |
| Personnage dans la rue (2-6, 11) | Génération IA à partir d'une image clé fixée du personnage |
| Façade, salle, cuisine (12-14) | Tournage réel au restaurant |
| Textes, prix, logo | Montage (jamais générés) |

Outils adaptés (fin 2026) : Veo, Kling, Runway, Sora ou équivalent pour la
vidéo ; génération d'images clés avec personnage fixé (référence visage) avant
toute animation. Les modèles produisent des clips de 5 à 10 s : chaque plan
ci-dessous est pensé pour être généré seul puis coupé au montage.

### Points validés avec le restaurant

- **Vente à emporter : oui.** La scène du tacos à la main dans la rue est
  donc fidèle à la réalité : Léa sort du Barrio Latino avec son tacos
  emballé. Si le restaurant a un emballage à emporter à lui (papier, sachet,
  barquette), le photographier et l'utiliser à la place du papier kraft
  générique.
- **Fromage : aucun.** Le tacos du Barrio Latino ne contient pas de fromage.
  Aucun plan ne doit en montrer, ni râpé, ni fondu, ni émietté (voir fiche
  produit et negative prompt).

---

## 1. Fiche produit — cohérence du tacos (d'après la photo)

À coller en tête de **chaque** prompt produit.

```
PRODUCT LOCK — Barrio Latino taco (match reference photo exactly):
- Soft yellow CORN tortilla, doubled, folded open in a loose U-shape, slightly
  irregular round edges, faint griddle spots, matte surface.
- Filling: generous shredded pulled chicken, orange-red from chili marinade,
  fine stringy fibres, moist but not dripping. One variant: darker pulled beef.
- Topping, in this order from top: one or two full RED ONION RINGS laid flat,
  thin julienned carrot strips, small dice of white onion, chopped fresh
  coriander/green herb. NO CHEESE of any kind.
- Served on a round light-wood board with handle, carved star pattern in the
  wood. Two small terracotta ramekins: smooth guacamole (pale green) and
  chunky fresh red salsa.
- Natural, hand-made, slightly imperfect. Not fast-food, not a hard shell,
  no lettuce, no cheese, no sour cream, no jalapeño slices.
```

Règles de continuité produit :

- Même nombre de rondelles d'oignon rouge (2 visibles) dans tous les plans.
- La bouchée (plan 5) laisse une marque cohérente : tous les plans suivants
  où elle tient le tacos montrent ce tacos entamé, côté gauche.
- Tacos tenu à la main : tortilla pliée, tenue par-dessous avec 3 doigts,
  pouce sur le bord, **dans une feuille de papier kraft** (réaliste pour de la
  street food, et masque les mains, point faible de l'IA).
- La bouteille de sauce de la photo : ne pas la montrer étiquette face caméra
  (marque déposée + texte généré déformé). Elle peut apparaître floue en fond.

---

## 2. Fiche personnage — cohérence

Créer d'abord **une image clé fixe** (portrait plan taille + plan buste, même
seed / même référence visage), la valider, puis l'utiliser comme référence
pour tous les plans.

```
CHARACTER LOCK — "Léa":
Woman, 26-28 years old, natural dark-blonde hair with slightly darker roots,
shoulder-length, loose soft waves, a few flyaway strands, tucked behind the
right ear. Light warm skin with visible natural texture, faint freckles on
nose and cheeks, no heavy makeup (light mascara, tinted lip balm). Slight
natural asymmetry in the smile, real teeth, not perfectly white.
Wardrobe (identical in every shot): cream ribbed knit short-sleeve top,
high-waisted straight light-blue jeans, thin tan leather belt, small gold hoop
earrings, one thin gold chain, white leather sneakers, small tan crossbody
bag on left shoulder. No hat, no sunglasses.
Attitude: relaxed, confident, amused, friendly — someone walking to meet a
friend, not a model posing.
```

Règles :

- Même raie (côté gauche), même mèche derrière l'oreille droite, mêmes bijoux.
- Sac toujours sur l'épaule gauche, tacos toujours main droite.
- Si un plan change la couleur des cheveux, du haut ou des boucles d'oreilles :
  le jeter, ne pas le « rattraper » à l'étalonnage.
- Pas de regard caméra avant le plan 6 (le regard caméra doit être un
  événement).

---

## 3. Décor — Rue du Port, Clermont-Ferrand

Ce qui rend Clermont reconnaissable et doit être dans les prompts :

- **Pierre de Volvic** : pierre volcanique gris foncé / anthracite, façades et
  encadrements de fenêtres sombres — la signature de la ville.
- Rue étroite du centre historique, **en pente**, pavés ou dalles de pierre,
  immeubles XVIIIe-XIXe de 3-4 étages, volets bois, balcons fer forgé.
- Quartier entre la cathédrale et la basilique Notre-Dame-du-Port. Une flèche
  de cathédrale noire en arrière-plan flou suffit à ancrer la ville.
- Petits commerces, vélos, un scooter, deux ou trois passants ordinaires
  (sac de courses, téléphone, poussette). Voitures françaises compactes
  garées, plaques non lisibles.
- **Recommandé** : faire 5 photos réelles de la rue du Port le matin et les
  donner comme images de référence de décor.

```
LOCATION LOCK:
Narrow sloping historic street in central Clermont-Ferrand, France. Buildings
of dark grey-black Volvic volcanic stone and pale rendered facades, 3-4
storeys, tall windows with wooden shutters, wrought-iron balconies, stone
paving. Distant dark gothic cathedral spire softly out of focus. Everyday
French street life, a few ordinary passers-by, a parked bicycle. Late
afternoon sun, early autumn. No readable signs, no Mexican decoration.
```

---

## 4. Lumière — instructions globales

- **Rue** : fin d'après-midi, soleil bas (≈ 17 h 30 en septembre-octobre),
  lumière rasante chaude venant de trois-quarts arrière (contre-jour doux sur
  les cheveux), ombres longues sur les pavés. Face éclairée par la réflexion
  des façades claires (pas de flash, pas de ring light).
- **Food** : une source principale douce, fenêtre latérale (5 600 K
  réchauffée vers 4 800 K), contre-jour léger pour détacher les fibres de
  viande et faire briller l'oignon rouge. Réflecteur blanc côté opposé.
  Noirs jamais bouchés.
- **Restaurant** : lumière existante, lampes chaudes 2 700-3 000 K,
  plus fenêtre du jour. Garder la vie de la salle, ne pas « relighter ».
- **Hero final** : table bois, clé latérale douce, fond de salle en bokeh
  chaud, légère vapeur montante captée en contre-jour.
- Vapeur : uniquement si le tacos est chaud dans le plan (plans cuisine /
  hero). **Jamais** de vapeur dans la rue sur un tacos déjà entamé.

---

## 5. Storyboard seconde par seconde (30,0 s · 25 i/s = 750 images)

| # | Timecode | Durée | Plan | Caméra / optique | Son | Texte |
|---|---|---|---|---|---|---|
| 1 | 0,0-3,0 | 3,0 | Très gros plan tacos sur la planche, fibres de viande, oignon rouge, coriandre | 85 mm macro, arc lent de 20° autour du tacos + légère descente, mise au point sur la rondelle d'oignon | Crépitement plaque, léger souffle de rue, 1ʳᵉ note de guitare | « ENVIE D'UN TACOS ? 🌮 » (0,3 → 2,8 s) |
| 2 | 3,0-5,0 | 2,0 | Léa marche vers nous dans la rue du Port, tacos kraft main droite, sourire | 50 mm, travelling arrière stabilisé (gimbal), f/2 | Pas sur la pierre, rue, beat qui entre | — |
| 3 | 5,0-7,0 | 2,0 | Plan latéral large : Léa passe devant les façades en pierre de Volvic, flèche de cathédrale floue au fond | 35 mm, travelling latéral, passant flou au premier plan en amorce | Ambiance rue, scooter lointain | — |
| 4 | 7,0-9,0 | 2,0 | Elle s'arrête, regarde le tacos, petit sourire, écarte une mèche | 50 mm, plan poitrine, handheld très stable | Papier kraft qui se froisse | — |
| 5 | 9,0-10,5 | 1,5 | Gros plan bouchée, profil trois-quarts | 85 mm, fixe, f/2,8 | Déchirure douce de la tortilla + croquant oignon (musique -6 dB) | — |
| 6 | 10,5-12,0 | 1,5 | Réaction : elle mâche, ferme brièvement les yeux, puis regarde caméra et sourit | 85 mm, léger push-in | « Mmh » naturel, petit rire | — |
| 7 | 12,0-13,2 | 1,2 | Macro : pince qui dépose la viande effilochée sur la tortilla | 100 mm macro, plongée 45°, rack focus | Viande qui tombe, grésillement | — |
| 8 | 13,2-14,4 | 1,2 | Macro : rondelle d'oignon rouge posée, gouttelette qui brille | Macro, top shot, léger glissement | Petit « tac » humide | — |
| 9 | 14,4-15,6 | 1,2 | Macro : coriandre ciselée qui tombe en pluie légère (vraie gravité) | Macro, 50 i/s ralenti à 50 % max | Froissement herbe | — |
| 10 | 15,6-17,0 | 1,4 | Cuillère de guacamole / salsa déposée à côté, puis tacos fini sur la planche | Macro, slider latéral lent | Cuillère sur terre cuite | — |
| 11 | 17,0-22,0 | 5,0 | Léa reprend sa marche, se retourne à demi vers la caméra : « On se retrouve au Barrio Latino ? » | 50 mm, travelling arrière puis léger arrêt, elle entre dans le cadre | Voix directe, musique qui monte | Sous-titre discret de la phrase |
| 12 | 22,0-23,2 | 1,2 | Façade du Barrio Latino, porte ouverte, quelqu'un entre | 35 mm, léger travelling avant | Porte, brouhaha qui s'ouvre | — |
| 13 | 23,2-24,6 | 1,4 | Salle vivante : table de 3-4 amis qui rient, mains qui prennent des tacos | 35 mm, handheld, amorce épaule | Rires, verres, conversation | — |
| 14 | 24,6-26,0 | 1,4 | Cuisine : tortilla retournée sur la plaque, main du cuisinier | 50 mm, plan serré | Grésillement, spatule | — |
| 15 | 26,0-30,0 | 4,0 | Hero shot : tacos sur table bois, vapeur, ramequins. Recadrage lent, puis texte | 85 mm, push-in très lent (5 %), f/2,8 | Musique pleine puis résolution sur la dernière mesure | Voir §8 |

Contrôle : 3,0 + 2,0 + 2,0 + 2,0 + 1,5 + 1,5 + 1,2 + 1,2 + 1,2 + 1,4 + 5,0 +
1,2 + 1,4 + 1,4 + 4,0 = **30,0 s**.

---

## 6. Prompts détaillés plan par plan

Format de chaque prompt : `[PRODUCT/CHARACTER/LOCATION LOCK concernés] +
prompt du plan + STYLE`. Générer chaque plan 20-30 % plus long que sa durée
finale (marges de coupe).

**STYLE (à ajouter à la fin de chaque prompt) :**

```
Shot on ARRI Alexa Mini LF, Cooke S4 lenses, natural light, shallow depth of
field, subtle organic film grain, gentle halation on highlights, true-to-life
skin and food colour, moderate contrast, warm but neutral white balance,
vertical 9:16, 4K, 24 fps, real motion blur, premium food commercial,
documentary-real, not stylised.
```

### Plan 1 — Hook (0-3 s) · image-to-video depuis la photo de référence

```
[PRODUCT LOCK]
Extreme close-up of the taco on the carved wooden board, camera at table
height 15 cm away, 85mm macro. Very slow smooth arc of 20 degrees from left
to right while lowering slightly, focus locked on the front red onion ring,
background ramekins melting into soft bokeh. Pulled chicken fibres glisten
softly, a few coriander leaves catch the side light. A thin wisp of steam
rises from the filling and dissolves naturally. Warm late-afternoon window
light from the left, soft white fill from the right. Nothing moves except the
camera and the steam. [STYLE]
```

### Plan 2 — Marche face (3-5 s)

```
[CHARACTER LOCK] [LOCATION LOCK]
Medium shot, 50mm, gimbal tracking backwards at walking pace. Léa walks
towards camera down the sloping stone street, holding the taco wrapped in
kraft paper in her right hand at chest height, taco clearly visible and in
focus. Natural relaxed stride, slight shoulder sway, hair moving gently with
her steps, a real small smile as if thinking of something pleasant. Low sun
behind her creating soft rim light on her hair. Two out-of-focus passers-by
in the background. [STYLE]
```

### Plan 3 — Latéral contexte ville (5-7 s)

```
[CHARACTER LOCK] [LOCATION LOCK]
Wide profile shot, 35mm, camera tracking sideways at her pace across the
street. Léa walks left to right past dark Volvic stone facades and wooden
shutters. A pedestrian crosses the foreground out of focus for a moment.
Distant black cathedral spire soft in the background. Long shadows on the
stone paving. Taco in right hand visible in silhouette. Ordinary French
street life, a parked bicycle, no readable signs. [STYLE]
```

### Plan 4 — L'arrêt (7-9 s)

```
[CHARACTER LOCK] [PRODUCT LOCK — held in kraft paper]
Medium close-up, 50mm, very steady handheld. Léa slows and stops, lowers her
gaze to the taco in her right hand, a small private smile, tucks a loose
strand of hair behind her right ear with her left hand. Kraft paper crinkles
slightly. Natural blink, relaxed face, no pose. [STYLE]
```

### Plan 5 — La bouchée (9-10,5 s)

```
[CHARACTER LOCK] [PRODUCT LOCK]
Close-up three-quarter profile, 85mm, locked-off. Léa lifts the taco and
takes a natural bite from the left end, tilting her head slightly, lips
closing around the corn tortilla, a little filling shifts naturally, one
shred of carrot falls. Real-time speed, no slow motion. Hand holds the taco
from below through the kraft paper, only thumb and two fingers visible.
[STYLE]
```

### Plan 6 — Réaction + regard caméra (10,5-12 s)

```
[CHARACTER LOCK]
Close-up, 85mm, very slow push-in. Léa chews with closed lips, eyes close
briefly with pleasure, she raises her eyebrows slightly, then opens her eyes
and looks straight into the lens with a spontaneous amused smile, one corner
of the mouth higher than the other, covering her mouth lightly with the back
of her left hand as she finishes chewing. Genuine, not posed. [STYLE]
```

### Plan 7 — Macro viande (12-13,2 s)

```
[PRODUCT LOCK]
Macro top-down 45 degrees, 100mm. Metal tongs place a generous portion of
orange-red pulled chicken onto an open doubled corn tortilla on a steel
kitchen counter. Fibres separate naturally, fall with real weight. Rack focus
from tongs to meat. Warm side light, visible texture of the tortilla.
Real-time speed. [STYLE]
```

### Plan 8 — Macro oignon rouge (13,2-14,4 s)

```
[PRODUCT LOCK]
Macro top shot, slight slow slide. A hand places one thin red onion ring flat
onto the pulled chicken, then a pinch of julienned carrot. The cut onion
surface is moist and glossy, light catches its purple-white layers. [STYLE]
```

### Plan 9 — Macro coriandre (14,4-15,6 s)

```
[PRODUCT LOCK]
Macro side angle, 50% slow motion maximum. Fingers sprinkle chopped fresh
coriander and small diced white onion over the taco; pieces fall with natural
gravity and bounce slightly, no floating, no swirling. Backlight makes the
herb glow green. [STYLE]
```

### Plan 10 — Sauce + tacos fini (15,6-17 s)

```
[PRODUCT LOCK]
Macro slow lateral slider move along the carved wooden board: a small spoon
lifts chunky red salsa from a terracotta ramekin, then the camera settles on
the finished taco next to the guacamole ramekin. Nothing floats, sauce has
real viscosity. [STYLE]
```

### Plan 11 — La réplique (17-22 s)

```
[CHARACTER LOCK] [PRODUCT LOCK — taco already bitten on the left end]
Medium shot, 50mm, gimbal tracking backwards. Léa walks again down the stone
street, taco in right hand. After two steps she turns her head and shoulders
halfway towards camera, smiles with complicity and says in French, casually,
at normal speaking pace: "On se retrouve au Barrio Latino ?" — slight upward
intonation, small tilt of the head at the end, then she keeps walking and
glances forward again. Natural lip movements matching French speech. Golden
low sun on her hair. [STYLE]
```

Conseil : si la synchro labiale n'est pas parfaite, la générer de dos puis de
trois-quarts (visage partiellement visible) et poser la voix enregistrée par
une vraie personne. Mieux vaut une bouche peu visible qu'une bouche fausse.

### Plans 12-14 — Le restaurant (22-26 s) · tournage réel recommandé

Si tournage réel : liste de plans à faire au smartphone, 4K 25 i/s, exposition
verrouillée, stabilisation activée, 10 s de chaque :

- 12 : façade depuis le trottoir d'en face, porte ouverte, un client entre.
- 13 : table de 3-4 amis (clients consentants ou équipe), mains qui prennent
  des tacos, rires. Cadrer mains/tables, pas de visages en gros plan sans
  autorisation écrite.
- 14 : plaque en cuisine, tortilla retournée à la spatule, vapeur.

Si image-to-video depuis vraies photos (fallback) :

```
Subtle realistic motion only: gentle handheld drift, people at the table
move naturally (laughing, reaching for food), warm 2700K lamps, window
daylight, lively contemporary Latin restaurant, natural wood and warm colours.
Do not change the room layout, decoration or signage from the source image.
[STYLE]
```

### Plan 15 — Hero final (26-30 s)

```
[PRODUCT LOCK]
Hero shot: the taco on the carved round wooden board on a warm wooden table
inside the restaurant, guacamole and salsa ramekins beside it, 85mm, camera
at 20 degrees above table height, extremely slow push-in (5%). Warm side key
light, background of the dining room in soft golden bokeh with faint
movement of people. A delicate wisp of steam rises and catches the backlight.
Leave the upper 40% of the frame calm and uncluttered for titles. [STYLE]
```

---

## 7. Mouvements de caméra — récapitulatif

| Plan | Mouvement | Vitesse | Règle physique |
|---|---|---|---|
| 1 | Arc 20° + descente | ≈ 7°/s | Pivot centré sur le tacos, horizon stable |
| 2 | Travelling arrière gimbal | Pas de marche | Micro-rebond vertical de marche conservé |
| 3 | Travelling latéral | Pas de marche | Parallaxe : premier plan plus rapide que le fond |
| 4 | Handheld stable | Quasi fixe | Micro-flottement naturel |
| 5 | Fixe | — | Aucun zoom |
| 6 | Push-in | Très lent | — |
| 7 | Fixe + rack focus | Bascule 0,5 s | — |
| 8 | Slide | 2 cm/s | — |
| 9 | Fixe, ralenti 50 % | — | Gravité réelle |
| 10 | Slider latéral | Lent | — |
| 11 | Travelling arrière puis arrêt | Pas de marche | La caméra ralentit quand elle se retourne |
| 12 | Avant léger | Lent | — |
| 13 | Handheld amorce | — | — |
| 14 | Fixe serré | — | — |
| 15 | Push-in 5 % | Très lent | — |

Interdits : zooms numériques rapides, rotations de caméra, drones, passage à
travers une vitre ou un objet, « whip pan » générés.

---

## 8. Textes à l'écran

Typographie (cohérente avec le site) : **Baloo 2 ExtraBold** pour les titres,
**Work Sans Medium** pour l'adresse. Couleurs : crème `#FBF3E5` sur l'image,
accent soleil `#F2811D` ou jaune `#F5B921` pour le prix, ombre portée très
douce (noir 25 %, flou 12 px) au lieu d'un contour.

Zone de sécurité 1080 × 1920 : textes dans le rectangle **x 90-900, y 260-1280**
(on évite les 250 px du haut, les 640 px du bas et la colonne d'icônes à
droite). Aucun texte essentiel sous y = 1280.

| Timecode | Texte exact | Taille (1080 px de large) | Animation |
|---|---|---|---|
| 0,3-2,8 | ENVIE D'UN TACOS ? 🌮 | 88 px | Fondu + montée 20 px, 8 images |
| 17,4-21,6 | On se retrouve au Barrio Latino ? | 44 px, bas de zone sûre | Sous-titre simple |
| 26,4-30,0 | 🌮 TOUS LES MERCREDIS | 64 px | Fondu 8 images |
| 26,8-30,0 | TORTILLA DE TACOS | 72 px | Fondu 8 images |
| 27,1-30,0 | **3,50 €** | 180 px, couleur accent | Arrivée légère (échelle 96 → 100 %, 6 images) |
| 28,2-30,0 | BARRIO LATINO | 76 px | Fondu |
| 28,2-30,0 | 9 rue du Port — 63000 Clermont-Ferrand | 38 px | Fondu |
| 28,9-30,0 | On se retrouve mercredi ? 🌮 | 44 px | Fondu |

Le prix reste à l'écran **2,9 s** en entier : assez pour être lu deux fois.
Vérifier l'orthographe caractère par caractère : « 3,50 € » (virgule, espace
insécable avant €), « Clermont-Ferrand » (trait d'union), « 9 rue du Port »,
« 63000 ».

Logo : si le Barrio Latino a un logo vectoriel, le substituer à
« BARRIO LATINO » sur 28,2-30,0. Sinon, le nom en Baloo 2 fait office de logo.

---

## 9. Musique

Direction : **latin groove moderne, 96 BPM**, dembow léger (reggaeton
instrumental très retenu), congas et shaker, guitare nylon en arpèges,
basse chaude ronde, un clap sec. Tonalité majeure, lumineuse.

Interdits : trompettes mariachi, guitarrón, cris « ¡ay ay ay! », banque de
sons de stock reconnaissable.

Courbe :

| Timecode | Musique |
|---|---|
| 0-3 | Guitare nylon seule, 2 mesures, -18 dB sous les sons food |
| 3-7 | Entrée shaker + basse, groove qui s'installe |
| 7-12 | Groove complet mais -6 dB pendant la bouchée (9-10,5) |
| 12-17 | Montée : dembow + congas, cuts du montage sur les temps |
| 17-22 | Baisse sous la voix (-10 dB), reprise en fin de phrase |
| 22-26 | Plein régime, ambiance restaurant par-dessus |
| 26-30 | Dernière phrase musicale qui résout pile à 29,6 s, 0,4 s de résonance |

Sources : composition originale (compositeur freelance) ou génération
musicale IA avec droits commerciaux, ou bibliothèque sous licence
(Artlist, Epidemic Sound) en choisissant un titre peu utilisé. Pour TikTok,
un son de la bibliothèque commerciale TikTok est obligatoire si le compte est
professionnel.

---

## 10. Sound design

| Timecode | Sons (réalistes, mixés subtilement) |
|---|---|
| 0-3 | Grésillement plaque lointain, couteau sur planche, rumeur de rue très basse |
| 3-7 | Pas en baskets sur pierre (synchro), rue : conversation lointaine, vélo, scooter à 50 m |
| 7-9 | Froissement papier kraft |
| 9-10,5 | Déchirure douce de tortilla de maïs, croquant d'oignon (pas un « crunch » de chips : la tortilla est souple) |
| 10,5-12 | Mastication très discrète, « mmh » et petit rire nasal |
| 12-17 | Viande qui tombe, grésillement, « tac » de l'oignon, pluie de coriandre, cuillère sur terre cuite — chaque son calé sur son cut |
| 17-22 | Voix directe (voir §12), pas, rue |
| 22-26 | Porte, brouhaha chaleureux, verres, rires, spatule sur plaque |
| 26-30 | Salle en fond très bas, léger grésillement, musique qui conclut |

Règles : musique baissée de 4-6 dB sur tous les plans food ; aucun « whoosh »
de transition ; loudness final **-14 LUFS intégré, true peak -1 dBTP**.

---

## 11. Montage

- Cadence 25 i/s (ou 24), coupes franches, **aucune transition d'effet**.
  Seule transition « douce » : un raccord par mouvement entre plan 11 (elle
  tourne à gauche) et plan 12 (façade), sur le même sens de déplacement.
- Plans 7-10 coupés sur les temps de la musique (tous les 2 temps à 96 BPM
  ≈ 1,25 s).
- Hook : la 1ʳᵉ image est déjà le tacos net et lumineux. Pas de fondu au noir
  au début.
- Raccord bouchée : plan 5 finit sur la fermeture des lèvres, plan 6 démarre
  sur la mastication (ellipse de 4 images).
- Fin : pas de fondu au noir. La dernière image (hero + textes) est tenue
  jusqu'à 30,0 s, pour qu'elle serve de miniature de reprise en boucle.
- Étalonnage : balance neutre-chaude, contraste modéré (courbe en S légère),
  saturation globale 0 à +5, saturation sélective : jaune tortilla +8, rouge
  piment/oignon +6, vert coriandre +5, tons chair protégés. Grain 35 mm fin
  identique sur tous les plans (unifie IA et smartphone). Pas de LUT « teal &
  orange ».
- Export : H.264 ou HEVC, 1080 × 1920 minimum (2160 × 3840 si les sources le
  permettent), 25 i/s, 20-35 Mb/s, AAC 320 kb/s.

---

## 12. Voix

Une seule réplique, **à l'image** (pas de voix off) :

> « On se retrouve au Barrio Latino ? »

Enregistrer une vraie voix de femme (amie, employée), au téléphone à 30 cm,
dans une pièce calme, 10 prises en variant le sourire. Choisir la prise la
plus « dite à une amie », pas la plus propre.

Voix off facultative, uniquement sur le final si les tests montrent un besoin
(même voix, chuchotée-souriante, sur 28,5-30,0) :

> « Tous les mercredis, au Barrio Latino. »

Ne pas lire le prix en voix off : il est écrit, et le lire rallonge sans
rien ajouter. Pas de voix de synthèse.

---

## 13. Version TikTok

- Durée 30,0 s, 1080 × 1920, son TikTok commercial si compte pro.
- **Hook renforcé** : le texte « ENVIE D'UN TACOS ? 🌮 » apparaît dès l'image
  3 (0,1 s), pas à 0,3 s.
- Sous-titres de la réplique en style TikTok natif (police de l'app) pour
  paraître moins « pub ».
- Zone de sécurité plus stricte : rien sous y = 1250, rien dans les 140 px de
  droite.
- Légende : « Tortilla de tacos à 3,50 € tous les mercredis, sur place ou à
  emporter 🌮 On se retrouve au 9 rue du Port ? #clermontferrand #tacos #barriolatino #clermont #foodclermont »
- Épingler un commentaire avec l'adresse et les horaires du mercredi.
- Variante test A/B : même spot, mais plan 5 (la bouchée) placé en ouverture
  à la place du plan 1. Garder celui qui retient le mieux à 3 s.

## 14. Version Instagram Reels

- 30,0 s, 1080 × 1920, musique sous licence intégrée au fichier (ou son
  Instagram si compte créateur).
- Miniature de couverture : image du hero final avec « 3,50 € · MERCREDI »,
  vérifiée en recadrage 4:5 (grille du profil) et 1:1.
- Hook à 0,3 s comme prévu (le public Reels scrolle un peu moins vite).
- Stories : exporter la même vidéo en 2 parties de 15 s (0-15 et 15-30) avec
  sticker lien vers l'itinéraire, et un sticker « compte à rebours » le mardi
  soir pour le mercredi.
- Légende : « Tous les mercredis : tortilla de tacos à 3,50 €, sur place ou à
  emporter 🌮
  Barrio Latino — 9 rue du Port, Clermont-Ferrand. On se retrouve mercredi ? »
- Publier le mardi 18 h-20 h et le mercredi 11 h-12 h (décision déjeuner/soir).

---

## 15. Negative prompt

À ajouter à **tous** les plans (et adapter selon l'outil) :

```
AI-generated look, CGI, 3D render, plastic skin, airbrushed skin, poreless
skin, doll face, perfect symmetry, uncanny valley, dead eyes, glassy eyes,
asymmetric eyes, cross-eyed, overly white teeth, too many teeth, merged teeth,
deformed mouth, lip-sync mismatch, frozen expression, robotic movement,
floating walk, sliding feet, moonwalking, jerky motion, morphing, warping,
melting, flickering, identity drift, hair colour change, hairstyle change,
outfit change, jewellery change, extra fingers, missing fingers, fused
fingers, six fingers, bent fingers, deformed hands, extra limbs, long neck,
distorted body proportions, taco changing shape, ingredients appearing or
disappearing, hard shell taco, fast-food taco, lettuce, cheese, grated cheese, melted cheese,
cheese crumbs, cheese pull, sour cream, jalapeños, floating food, flying ingredients, spinning
ingredients, exploding food, sauce splash, fake steam, excessive steam,
glossy plastic food, oversaturated colours, neon colours, HDR look, teal and
orange grade, Instagram filter, heavy vignette, lens flare overload,
excessive bokeh balls, camera passing through objects, impossible camera
move, drone shot, fisheye, wobbly background, warping buildings, bending
lines, duplicated people, faceless passers-by, cars morphing, gibberish text,
misspelled text, readable signs, generated logos, watermark, subtitles,
brand labels facing camera, Mexican caricature, sombrero, cactus, maracas,
piñata, papel picado, mariachi, desert, palm trees, Spanish colonial
architecture, American suburban street, influencer pose, duck face, peace
sign, looking at camera constantly, runway walk, slow motion overuse.
```

---

## 16. Checklist avant export

**Durée et format**
- [ ] Durée exacte 30,0 s (750 images à 25 i/s)
- [ ] 9:16, 1080 × 1920 minimum, -14 LUFS, true peak ≤ -1 dBTP
- [ ] Tous les textes dans la zone de sécurité (tester avec un calque
      d'interface TikTok et Instagram)

**Offre et identité**
- [ ] « TOUS LES MERCREDIS » visible et correctement écrit
- [ ] « TORTILLA DE TACOS » correctement écrit
- [ ] Prix exact **3,50 €**, virgule, espace, symbole €, affiché ≥ 2,5 s
- [ ] « BARRIO LATINO » lisible
- [ ] « 9 rue du Port — 63000 Clermont-Ferrand » exact
- [ ] « On se retrouve mercredi ? 🌮 » en dernière phrase
- [ ] Émojis rendus correctement à l'export (pas de carrés vides)

**Produit**
- [ ] Tortilla de maïs souple, jaune, doublée — jamais une coque dure
- [ ] Viande effilochée orangée, oignon rouge en rondelles, carotte, coriandre
- [ ] Aucun ingrédient absent de la photo de référence
- [ ] Aucune trace de fromage dans aucun plan
- [ ] Tacos entamé du même côté dans tous les plans après la bouchée
- [ ] Planche bois gravée + ramequins terre cuite identiques

**Personnage**
- [ ] Même visage, cheveux, raie, bijoux, vêtements dans tous les plans
- [ ] Mains : 5 doigts, prise crédible, image par image sur les plans 4-6 et 11
- [ ] Dents et bouche naturelles pendant la bouchée et la réplique
- [ ] Synchro labiale correcte sur « On se retrouve au Barrio Latino ? »
- [ ] Aucune expression figée, aucun regard vide

**Décor**
- [ ] Rue crédible de Clermont : pierre sombre de Volvic, rue en pente
- [ ] Aucune enseigne ou plaque avec texte déformé
- [ ] Passants et voitures sans déformation
- [ ] Façade et salle = le vrai Barrio Latino
- [ ] Aucun cliché (sombrero, cactus, maracas, mariachi)

**Qualité perçue**
- [ ] Visionné en entier sur un vrai téléphone, luminosité moyenne, son coupé
      puis son activé
- [ ] Montré à 3 personnes sans contexte : aucune ne dit « c'est de l'IA »
- [ ] Les 3 réactions obtenues : « ça donne faim », « ça a l'air sympa »,
      « j'y vais mercredi »
- [ ] Droits : musique sous licence commerciale, autorisations écrites des
      personnes filmées dans la salle
