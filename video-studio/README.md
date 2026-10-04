# Claude Video Studio Pro

Chaîne de montage vidéo automatisée, locale et vérifiable : **FFmpeg + Python**.
Vous déposez des rushs, vous choisissez un style (ou le système le choisit), et vous obtenez
une prévisualisation puis des exports réellement montés, contrôlés image par image et son
compris, avec un rapport de ce qui reste à vérifier par un humain.

> Aucune publication automatique. Aucun rush n'est modifié ni supprimé. Aucun texte, citation
> ou dialogue n'est inventé.

## En 5 minutes

```bash
cd video-studio
pip install -r requirements.txt          # numpy (+ moteurs de transcription facultatifs)
python3 studio.py doctor                  # vérifie FFmpeg, filtres, moteurs
python3 studio.py demo                    # crée des rushs de démonstration synthétiques
python3 studio.py run demo --lang en --music input/demo/musique/demo_100bpm.wav \
        --music-provenance "synthétisée localement"
```

Avec vos vidéos :

1. Déposez-les dans `video-studio/input/mon-projet/` (un fichier `.srt` du même nom à côté
   d'une vidéo est utilisé comme transcription, prioritairement).
2. `python3 studio.py run mon-projet --profile culinaire --preset reels --duration 45`
3. Regardez `projects/mon-projet/previews/…_preview.mp4` et le rapport `qc/…_qc.md`.
4. Corrigez en français : `python3 studio.py revise mon-projet "Fais un montage plus dynamique"`
5. `python3 studio.py export mon-projet` puis, après visionnage :
   `python3 studio.py approve mon-projet --by "Votre nom"`.

Interface graphique locale : `python3 studio.py ui` puis http://127.0.0.1:8765
Dans Claude Code : commandes `/video-help`, `/video-import`, `/video-edit`, `/video-preview`…

## Ce que fait réellement le système (implémenté et testé)

| Étape | Ce qui est fait |
|---|---|
| Ingestion | formats, durée, codecs, rotation, cadence variable, décodage d'intégrité ; fichiers corrompus rejetés avec la raison ; doublons ignorés |
| Analyse | plans (scdet), exposition, netteté, mouvement, tremblements, position du sujet, dominante ; activité sonore, pauses, loudness, saturation, bruit ; transcription ; prises répétées ; doublons ; vignettes ; rapport |
| Brief et plan | profil choisi ou déduit, valeurs par défaut annoncées, timeline JSON modifiable + plan lisible avec la raison de chaque coupe |
| Montage | la phrase est insécable ; pauses raccourcies (jamais supprimées) ; dernière prise gardée ; plans de coupe sur la parole ; respirations ; accroche (teaser signalé) ; plan de fin ; calage musical des plans sans parole |
| Finition | recadrage / fond flouté selon l'orientation ; correction couleur simple + profils ; voix (passe-haut, débruitage modéré, compression légère, égalisation des niveaux entre rushs) ; ducking de la musique ; EBU R128 deux passes ; fondus |
| Sous-titres | découpage lisible, typographie française, styles, SRT/VTT/ASS, mots incertains listés, titres, intervenants, texte de fin |
| Rendu | segments mis en cache (reprise), assemblage, prévisualisation filigranée, exports multi-formats |
| Contrôle qualité | relecture du fichier produit : jusqu’à 20 contrôles (voir docs/ARCHITECTURE.md), planche contact, corrections automatiques simples |
| Révisions | 15+ formulations en français → modifications explicites ; versions conservées ; révisions locales sans tout recalculer ; variantes |
| Lot, reprise | `batch` ; toute commande relancée reprend où elle s'était arrêtée |

Les limites sont listées sans détour dans [docs/LIMITES.md](docs/LIMITES.md).

## Organisation

```
video-studio/
  studio.py            point d'entrée (python3 studio.py help)
  vstudio/             code (ingest, analysis/, planner, render, subtitles, qc, pipeline, revise, reference, ui)
  presets/             export.toml, profiles.toml (+ profiles/ personnalisés), color.toml, subtitles.toml,
                       principes_editoriaux.toml
  input/               vos rushs (non versionnés)
  projects/<projet>/   project.json, journal.log, analysis/, transcripts/, timeline/, cache/, subtitles/,
                       previews/, exports/, qc/
  assets/              music/, fonts/, logos/, overlays/ (avec leurs licences)
  references/          mesures de vidéos de référence autorisées
  docs/                documentation
  tests/               tests automatisés (pytest)
```

## Commandes

`run`, `new`, `import`, `analyze`, `style`, `edit`, `captions`, `audio`, `color`, `preview`, `revise`,
`export`, `quality`, `approve`, `batch`, `project`, `reference`, `principles`, `demo`, `ui`, `doctor`.
Détail : `python3 studio.py <commande> -h` et [docs/GUIDE.md](docs/GUIDE.md).

## Tests

```bash
cd video-studio && python3 -m pytest -q          # ≈ 10 min : de vrais fichiers sont rendus et relus
```

## Documentation

- [docs/GUIDE.md](docs/GUIDE.md) — guide d'utilisation pas à pas
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — modules, données, contrôles
- [docs/INSTALLATION.md](docs/INSTALLATION.md) — dépendances, modèles de transcription
- [docs/PRINCIPES_EDITORIAUX.md](docs/PRINCIPES_EDITORIAUX.md) — règles de montage appliquées
- [docs/LIMITES.md](docs/LIMITES.md) — ce qui n'est pas (encore) fait
- [docs/AUDIT.md](docs/AUDIT.md) — audit initial et choix techniques
