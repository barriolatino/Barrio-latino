# Automatisations qui touchent le site

Routines claude.ai créées par Clément le 17/11/2026 (identifiants, prompts et dépendances : `claude-studio/memory/AUTOMATIONS.md`).

| Nom | Quand (Paris) | Script lancé | Fichiers modifiés |
|---|---|---|---|
| Avis Google → site | chaque jour 9 h | `python3 -I outils/maj-avis-google.py --note X --nombre N` | `assets/data/avis.json`, `index.html` |
| Rotation avis du site | lundi 9 h | `python3 -I outils/rotation-avis.py` | `assets/data/avis.json`, `outils/avis-reserve.json` |

Formulaire de réservation → e-mail Formspree (constante `FORMSPREE` de `main.js`) → tâche « Réservations → agenda » côté claude-studio.
Publication : GitHub Pages, automatique à chaque push sur `main` (1 à 2 minutes).
