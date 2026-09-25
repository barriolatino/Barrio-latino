# Idées, anti-répétition, script

| Module | Rôle |
|---|---|
| `selection.py` | banque d'idées (`content/ideas.json`) : sélection, rotation par pilier, parts cibles, apprentissage par les statistiques, nouvelles combinaisons |
| `repetition.py` | compare une publication aux publications produites sur 8 dimensions : sujet, angle, informations, format, hook, visuels, CTA, formulation |
| `script.py` | brouillon structuré (HOOK → PROMESSE → INFORMATION → SURPRISE → CONCLUSION → CTA) et vérification du style oral, des hooks et du SEO |

L'écriture du texte est faite par Claude Code : `script.py` prépare le squelette et vérifie
le résultat, il n'appelle aucune API de génération.

CLI : `pick`, `bank`, `combine`, `draft NN`, `lint NN`, `repeat-check NN` ou
`repeat-check --title … --theme … --angle … --format …`.

Réglages : `config/content-pillars.json` (rotation, délais), `config/production.json`
(types de hook), `config/video-style.json` et `config/carousel-style.json` (durées, limites).
