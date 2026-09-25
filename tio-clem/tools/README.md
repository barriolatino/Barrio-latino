# Outils

| Fichier | Rôle |
|---|---|
| `factory.py` | CLI : `calendar`, `next`, `draft`, `lint`, `research-check`, `repeat-check`, `build`, `review`, `export`, `pick`, `bank`, `combine`, `stats` |
| `content/` | sélection des idées, anti-répétition, script (Phase 2) |
| `research/` | validation des recherches et `sources.json` (Phase 2) |
| `render.py` | rendu : cartes, animation, vidéo H.264/AAC, sous-titres libass, cover |
| `check.py` | tests de structure : config, base de contenu, commandes, `.env.example` |
| `tests/` | tests unitaires (`python3 -m unittest discover -s tools/tests`) |
| `move-to-own-repo.sh` | extrait le projet vers un dépôt dédié, historique compris |

`images/`, `voice/`, `subtitles/`, `video/`, `carousel/`, `quality-control/` accueilleront
leur module aux phases 3 à 5 ; chaque README dit où se trouve la fonction aujourd'hui.
