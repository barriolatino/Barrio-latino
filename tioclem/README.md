# Tio Clem : Content Factory 🇵🇪

Moteur de production des publications TikTok de **Tio Clem (@tioclem15)** : d'une
idée de sujet sur le Pérou à un dossier prêt à publier (vidéo 1080x1920, cover,
sous-titres, script, description, hashtags, sources, contrôle qualité).

Le créateur n'a plus qu'à **vérifier puis publier**. Rien n'est publié automatiquement.

## Commandes Claude Code

| Commande | Effet |
|---|---|
| `/create 1` | crée le prochain contenu du calendrier |
| `/create 5` | crée 5 publications |
| `/create-day 14` | crée uniquement le jour 14 |
| `/batch 7` | crée un lot de 7 publications |
| `/calendar` | affiche le calendrier et l'état de chaque jour |
| `/idea 20` | génère 20 nouvelles idées et les ajoute à la banque |
| `/pick 5` | propose les 5 meilleures idées à produire maintenant |
| `/bank` | état de la banque : idées restantes, catégories sous-représentées |
| `/stats 1 …` | enregistre les stats TikTok d'un post (la sélection en tient compte) |
| `/research sujet` | fait uniquement la recherche |
| `/review` | revérifie les publications produites |
| `/export` | rassemble les fichiers prêts à publier (zip) |
| `/month` | produit les 30 jours |
| `/daily` | produit le prochain jour non produit et le marque READY_TO_PUBLISH |

Les commandes sont dans `.claude/commands/`. Les règles éditoriales sont dans
[`PLAYBOOK.md`](PLAYBOOK.md).

## Qui fait quoi

- **Claude** fait la recherche (sources fiables, comparées, archivées dans
  `research/`) et l'écriture (`content/posts/day-NN.json`).
- **`factory.py`** fait tout le reste de façon reproductible : rendu des cartes,
  animation, montage, sous-titres `.srt` incrustés, cover, fichiers texte, contrôle
  qualité en 15 points avec corrections automatiques, historique, export.

```bash
bash tioclem/setup.sh                    # dépendances (Pillow, ffmpeg, correcteur)
python3 tioclem/factory.py calendar      # état des 30 jours
python3 tioclem/factory.py next          # prochain jour à produire
python3 tioclem/factory.py build 1       # rendu + contrôle qualité du jour 1
python3 tioclem/factory.py review all    # revérifie tout
python3 tioclem/factory.py export        # zip des publications prêtes
python3 tioclem/factory.py pick 5        # meilleures idées de la banque
python3 tioclem/factory.py bank          # équilibre du fil et idées restantes
python3 tioclem/factory.py combine 20    # nouvelles combinaisons sujet + angle
python3 tioclem/factory.py stats 1 --vues 2500 --likes 180 --commentaires 22
```

## Banque d'idées

`content/topics.json` contient les 200 idées de départ (plus 2 venues du
calendrier), notées sur 7 critères. `content/angles.json` liste les angles, publics
et émotions à combiner. Après les 30 jours du calendrier, la production pioche dans
la banque. Règles : jamais trois publications de suite dans la même catégorie, jamais
deux fois le même thème avec le même angle, un thème ne revient pas avant 5 posts.
Les statistiques saisies avec `/stats` orientent les choix suivants. Détails :
`PLAYBOOK.md` §27.

## Rendre la vidéo plus personnelle

- **Tes photos** : dépose `content/media/day-01/scene01.jpg` (une par scène, ou
  `cover.jpg`), puis relance `build 1`. La photo remplace l'illustration, avec un
  voile sombre pour la lisibilité.
- **Ta voix** : enregistre `script.txt`, dépose `content/voice/day-01.m4a`, relance
  `build 1`. Les scènes et les sous-titres se recalent sur ta voix.
- Sans voix, la vidéo a une piste audio silencieuse : ajoute un son dans TikTok.

## Arborescence

```
tioclem/
  PLAYBOOK.md            règles éditoriales
  factory.py             CLI : calendar, next, build, review, export
  render.py              rendu Pillow + ffmpeg (H.264/AAC, libass)
  assets/fonts/          Anton, Montserrat (licence OFL)
  assets/lexique.txt     mots acceptés par le correcteur
  bank.py                sélection, rotation, anti-répétition, apprentissage
  content/calendar.json  les 30 jours (reliés à la banque)
  content/topics.json    banque d'idées notées
  content/angles.json    angles, publics, émotions, intentions
  content/published.json historique (anti-répétition)
  content/posts/         un JSON par publication (script, scènes, SEO…)
  content/media/         tes photos (optionnel)
  content/voice/         tes voix off (optionnel)
  research/              une recherche sourcée par sujet
  output/<date>-<slug>/  video.mp4, cover.jpg, script.txt, caption.txt,
                         hashtags.txt, subtitles.srt, sources.json,
                         scenes.json, qa.json, README.txt
```

Ce dossier est indépendant du site du restaurant (`index.html`) et n'est pas chargé
par GitHub Pages.
