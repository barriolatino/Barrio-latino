# Outils

| Fichier | Rôle |
|---|---|
| `factory.py` | CLI : `calendar`, `next`, `draft`, `lint`, `research-check`, `repeat-check`, `asset-add`, `build`, `review`, `export`, `pick`, `bank`, `combine`, `stats` |
| `content/` | sélection des idées, anti-répétition, script (Phase 2) |
| `research/` | validation des recherches et `sources.json` (Phase 2) |
| `voice/` | voix off : voix humaine ou synthèse (none, mock, piper, openai, elevenlabs) (Phase 3) |
| `images/` | visuels : photos, images sourcées (Mode A), générées (Mode B), cartes (Phase 3) |
| `subtitles/` | sous-titres : calage sur la voix, `.srt`, lisibilité (Phase 3) |
| `env.py`, `net.py` | lecture de `.env` ; appels HTTP des fournisseurs |
| `render.py` | rendu : cartes, animation, vidéo H.264/AAC, sous-titres libass, cover |
| `check.py` | tests de structure : config, base de contenu, commandes, `.env.example` |
| `tests/` | tests unitaires (`python3 -m unittest discover -s tools/tests`) |
| `move-to-own-repo.sh` | extrait le projet vers un dépôt dédié, historique compris |

`video/`, `carousel/`, `quality-control/` accueilleront leur module aux phases 4 et 5 ;
chaque README dit où se trouve la fonction aujourd'hui.
