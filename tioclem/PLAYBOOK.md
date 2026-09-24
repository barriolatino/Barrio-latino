# Tio Clem : playbook éditorial

Référence pour toute production du compte TikTok **Tio Clem (@tioclem15)**.
Les commandes `/create`, `/daily`, `/month`, etc. renvoient à ce fichier.

Priorités, dans cet ordre : **exactitude › intérêt › authenticité › rétention ›
esthétique › automatisation**. L'automatisation ne passe jamais avant la qualité.
Le résultat doit donner l'impression d'une vraie personne passionnée par le Pérou,
jamais celle d'une vidéo fabriquée par une IA.

## 1. Identité

Compte francophone pour découvrir le Pérou : cuisine, culture, histoire, géographie,
traditions, voyage, langue, expressions, société, anecdotes, dégustations, faits
insolites, différences France/Pérou.

Ton : chaleureux, curieux, enthousiaste, accessible, pédagogique, humain, avec une
pointe d'humour. Jamais robotique, universitaire, trop formel, artificiel ou
sensationnaliste. On tutoie.

## 2. Chaîne de production

```
IDÉE → RECHERCHE → SCRIPT → VISUELS → MONTAGE → SOUS-TITRES → COVER
     → DESCRIPTION → HASHTAGS → CONTRÔLE → EXPORT          (humain : VÉRIFIER → PUBLIER)
```

| Étape | Qui | Fichier |
|---|---|---|
| Recherche | Claude (WebSearch / Firecrawl) | `research/<slug>.json` |
| Script, scènes, cover, description, hashtags, SEO | Claude | `content/posts/day-NN.json` |
| Visuels, montage, sous-titres, cover, export | `factory.py build NN` | `output/<date>-<slug>/` |
| Contrôle qualité automatique + corrections | `factory.py build` / `review` | `output/.../qa.json` |
| Historique | `factory.py` | `content/published.json` |
| Vérification finale et publication | **le créateur** | — |

Rien n'est jamais publié automatiquement sur TikTok.

## 3. Recherche (obligatoire avant d'écrire)

Aucun contenu factuel ne vient uniquement des connaissances internes.

1. Rechercher le sujet, identifier les sources fiables, comparer, noter les désaccords.
2. Ne garder que ce qui est suffisamment établi.
3. Priorité des sources : institutions › organismes officiels péruviens (gob.pe,
   Ministerio de Cultura, Andina, PromPerú) › musées › universités › publications
   scientifiques › organismes internationaux (UNESCO…) › médias reconnus › autres.
4. Sujets historiques, culturels ou scientifiques : plusieurs sources.
5. `WebFetch` est bloqué pour beaucoup de domaines dans l'environnement cloud :
   utiliser `mcp__Firecrawl__firecrawl_scrape` pour lire une page.

Format de `research/<slug>.json` (voir `research/ceviche.json`) :
`sujet, slug, day, date, angle, angles_reserves[], sources[{id, titre, editeur, type,
priorite, url, date_publication, consulte_le}], faits[{id, fait, statut, confiance,
sources[], utilise_dans[]}], desaccords[], informations_ecartees[{information, raison}]`.

- `statut` : `FAIT ÉTABLI`, `HYPOTHÈSE`, `LÉGENDE` ou `INTERPRÉTATION`.
- `confiance` : `haute`, `moyenne` ou `basse`. Un fait `basse` ne va jamais à l'écran.
- `angles_reserves` : les angles gardés pour de futurs posts sur le même thème.

## 4. Angle éditorial

Ne jamais transformer Wikipédia en script. Chaque post a :
**promesse** (pourquoi regarder), **hook** (pourquoi rester), **information** (ce
qu'on apprend), **émotion** (surprise, curiosité, amusement, émerveillement, envie),
**interaction** (pourquoi commenter).

## 5. Hooks

Écrire 5 hooks aux structures différentes (pas deux qui commencent pareil) :
question piège, idée reçue corrigée, « si tu vas au Pérou… », surprise, erreur
fréquente des Français… Garder le plus adapté et justifier le choix
(`hook_reason`). Pas de promesse exagérée ni d'affirmation non sourcée.

## 6. Vidéo (20 à 45 s)

| Temps | Rôle |
|---|---|
| 0–3 s | HOOK (la voix off de la scène 1 = le hook choisi) |
| 3–10 s | CONTEXTE |
| 10–25 s | INFORMATIONS PRINCIPALES |
| 25–35 s | INFORMATION SURPRENANTE |
| 35–45 s | CTA |

Voix off : phrases courtes, ponctuation qui crée les pauses, style oral naturel
(« c'est pas », « là-bas »). Ne jamais commencer par « Bonjour à tous, aujourd'hui… ».
Débit de référence : 3 mots/s. Une scène ne dépasse pas 8 s. `factory.py` calcule
les durées à partir du nombre de mots.

Chaque scène : `id, role (hook|contexte|info|surprise|cta), number?, voiceover,
on_screen{title, emoji, subtitle}, visual{need, description, emoji, palette},
animation ("zoom léger", "titre qui pop", ou les deux), facts[]`.

## 7. Carrousel (7 à 9 slides)

Slide 1 : hook. Slide 2 : contexte. Slides 3 à 7 : une idée par slide.
Avant-dernière : résumé ou info bonus. Dernière : CTA. Titre de 9 mots maximum,
`body` de 170 caractères maximum. Pas de gros paragraphes.

Chaque slide : `id (slide01…), role, number?, title, body?, subtitle?, emoji, palette, facts[]`.

## 8. Contenus interactifs (tu préfères, quiz, comparaison)

Conçus pour les commentaires (« Team tallarines verdes 🌿 ou team tallarines
rojos 🍅 ? »). **Ne jamais désigner de gagnant** : le public décide. Pour un quiz,
les réponses peuvent venir en fin de vidéo ou en commentaire épinglé.

## 9. Expressions péruviennes

Pour chacune : expression, signification, prononciation, contexte, exemple,
équivalent français approximatif, niveau de familiarité, région si pertinent.
Ne jamais présenter une expression régionale comme utilisée dans tout le Pérou.

## 10. Français vs espagnol

Expliquer la différence, donner un exemple, préciser le contexte, éviter les
généralisations. Distinguer si utile espagnol d'Espagne / d'Amérique latine / du Pérou.

## 11. Histoire

Toujours distinguer **FAIT ÉTABLI**, **HYPOTHÈSE**, **LÉGENDE** et **INTERPRÉTATION**.
Une légende n'est jamais racontée comme un fait : « Selon une tradition… »,
« Une hypothèse propose que… ». Le contrôle qualité refuse une scène qui s'appuie
sur une hypothèse ou une légende sans formule de précaution.

## 12. Culture

Pas de « Les Péruviens font toujours… ». Plutôt : « Dans certaines régions… »,
« Cette tradition est très présente à… », « Beaucoup de familles… » quand les
données le permettent.

## 13. Gastronomie

Pour chaque plat, chercher : origine, région, ingrédients, histoire, évolution,
contexte culturel. Ne jamais inventer une origine. Si elle est discutée, le dire.

## 14. Visuels

Pour chaque scène : visuel nécessaire, description, durée, texte à l'écran,
animation (`scenes.json` en sortie). Par défaut, `factory.py` produit des cartes
graphiques à la charte Tio Clem. Pour plus d'authenticité, le créateur dépose ses
propres photos dans `content/media/day-NN/scene01.jpg` (ou `slide01.jpg`,
`cover.jpg`) : elles remplacent l'illustration au rendu suivant.

Palettes : `rojo`, `crema`, `ají`, `selva`, `mar`. Éviter deux scènes consécutives
de la même couleur.

## 15. Production vidéo

1080x1920, 9:16, 30 fps, H.264 + AAC, faststart. FFmpeg (fourni par `imageio-ffmpeg`).

## 16. Voix off

Aucune voix de synthèse n'est utilisée : elle casserait l'authenticité. Deux options :

- le créateur enregistre `script.txt`, dépose le fichier dans
  `content/voice/day-NN.m4a`, puis relance `factory.py build NN` (les scènes et
  sous-titres se recalent sur la durée de l'enregistrement) ;
- ou il publie la vidéo telle quelle (piste audio silencieuse) et ajoute un son
  dans l'application TikTok. Le texte à l'écran et les sous-titres portent le message.

## 17. Sous-titres

`.srt` livré + incrustation (libass). Zones sûres TikTok respectées : texte entre
x = 72 et 930 px, y = 200 et 1480 px (barre du haut, colonne d'icônes à droite,
légende et boutons en bas). 2 lignes maximum, 30 caractères par ligne maximum.

## 18. Cover

Verticale, 3 à 7 mots, emoji possible : « TU CONNAIS CE PLAT ? 🇵🇪 »,
« AVANT LES INCAS… », « 3 RÉGIONS, 1 PAYS 🇵🇪 ». Même charte que la vidéo.

## 19–21. Description, hashtags, SEO

- Description naturelle, avec le mot-clé principal, un CTA et une question.
  Pas de bourrage de mots-clés (2 occurrences maximum), pas de hashtags dedans.
- 5 à 8 hashtags : général + Pérou + thématique + précis. Toujours `#TioClem` et
  un hashtag Pérou. Sans accents (`#Perou`, `#CuisinePeruvienne`).
- SEO : `seo.main` (mot-clé principal), `seo.onscreen` (forme courte visible à
  l'écran), `seo.secondary[]`, `seo.question` (question recherchable),
  `seo.expressions[]`. Le mot-clé principal apparaît dans le script, à l'écran et
  dans la description.

## 22. Contrôle qualité

`factory.py build` vérifie : exactitude, sources, orthographe, grammaire, hook,
rythme, durée, format 1080x1920, cohérence visuelle (charte + zones sûres), cover,
sous-titres, CTA, description, hashtags, absence de répétition. Il corrige seul la
typographie (espaces avant ? ! : ;, mots doublés), les hashtags (accents, doublons,
nombre) et la longueur de la cover.

Pour le reste (un fait mal sourcé, une scène trop longue, un mot-clé absent),
**Claude corrige `day-NN.json` ou la recherche, puis relance le build**, jusqu'à
obtenir `READY_TO_PUBLISH`. Relire en plus soi-même le texte : orthographe, accords,
naturel à l'oral.

## 23–24. Historique et anti-répétition

`content/published.json` garde pour chaque post : date, sujet, catégorie, format,
angle, hook, mots-clés, statut. Avant toute création : le lire. Ne jamais reproduire
un sujet à l'identique. Un thème peut revenir (ex. ceviche : histoire, ingrédients,
dégustation, comparaison, quiz, régions) à condition de changer d'angle, de hook,
de format, d'informations, de visuels et de CTA. Les `angles_reserves` de la
recherche servent à ça.

## 26. Sortie

```
output/<date>-<slug>/
  video.mp4        (vidéo)        slides/01.jpg…  (carrousel)
  cover.jpg  script.txt  caption.txt  hashtags.txt  subtitles.srt
  sources.json  scenes.json  qa.json  README.txt
```

## 30. Règle absolue

Ne jamais prétendre qu'un fichier existe s'il n'a pas été produit. Toujours
terminer en listant ce qui a été créé, les sources et ce qu'un humain doit vérifier.
