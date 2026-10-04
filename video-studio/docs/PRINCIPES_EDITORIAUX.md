# Principes éditoriaux appliqués

Ces règles sont codées dans `planner.py`, `render.py`, `subtitles.py` et les profils. Elles visent un
montage qui paraît pensé par un monteur, pas fabriqué par une machine.

## Respect de la source

- La **phrase est l'unité insécable** : une coupe tombe entre deux phrases, avec une marge
  (`speech_pad`) pour ne pas mordre une syllabe. Testé : aucun mot gardé n'est coupé.
- **L'ordre des propos est conservé.** Le seul déplacement autorisé est le *teaser* : une phrase
  courte et forte **répétée** en ouverture (elle reste aussi à sa place), toujours signalée pour
  validation.
- Si la durée cible oblige à retirer des phrases, le plan liste lesquelles et demande une
  vérification du sens.
- **Rien n'est inventé** : titres, noms, appels à l'action et corrections de transcription viennent
  de l'utilisateur. Les mots mal reconnus sont signalés, jamais devinés.
- Les contenus générés (démonstration) sont identifiés par un fichier PROVENANCE.

## Rythme naturel

- Les pauses longues sont **raccourcies, pas supprimées** : `pause_max` → `pause_keep`. Le profil
  `humour` garde les silences avant la chute ; `interview` garde les respirations.
- Dernière prise gardée en cas de répétition (décision listée, réversible).
- Plans d'illustration : fenêtre choisie là où il se passe quelque chose ; durée entre `min_shot` et
  `max_shot` ; alternance des rushs pour varier les cadrages.
- Plans de coupe pendant la parole : le visage reste visible 1,5 s au début et 0,8 s à la fin.
- La musique ne cale que les coupes des plans **sans parole** (tolérance du profil), jamais la parole.

## Sobriété

- Coupe franche par défaut ; fondu enchaîné seulement dans les profils qui le justifient et entre
  rushs différents.
- Pas de zoom automatique, pas de glitch, pas de ralenti automatique, pas d'animation mot à mot.
- Couleur : corrections modérées (saturation ≤ 1,08 hors noir et blanc), dominante forte respectée.
- Son : débruitage plafonné, compression légère, ambiances conservées.

## Fin intentionnelle

Dernière phrase, plan de conclusion si disponible, fondu son et image. Contrôlé sur le fichier rendu.

## Bibliothèque de principes

`presets/principes_editoriaux.toml` (commande `principles`) : chaque principe a un domaine
d'application, une justification, des limites, un exemple original, une date de vérification et un
niveau de confiance. Ils ne promettent aucune viralité.
