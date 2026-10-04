---
name: video-editing
description: Montage vidéo automatisé avec Claude Video Studio Pro : quand l'utilisateur veut monter des rushs, produire une vidéo, enchaîner import → analyse → plan → prévisualisation → export. Déclenche aussi sur « monte cette vidéo », « fais un montage », « /video-edit ».
---

# Montage vidéo (orchestration)

Le montage est fait par le logiciel `video-studio/studio.py` (FFmpeg + Python). Cette skill décrit comment le piloter ; elle ne remplace pas le logiciel.

## Parcours
1. `python3 video-studio/studio.py run <projet> --input <rushs> [--profile] [--preset] [--duration] [--music --music-provenance] [--lang]`
2. Lire `projects/<projet>/timeline/plan_vXXX.md` (décisions) et `qc/*_qc.md` (contrôle).
3. Ouvrir la planche contact (`qc/*_planche.jpg`) avec Read : juger l'image réelle, pas seulement les chiffres.
4. Corriger avec `revise "<instruction>"`, puis `export`. La validation (`approve --by`) appartient à l'utilisateur.

## Règles
- Ne jamais annoncer une vidéo « prête » si le contrôle qualité est en échec.
- Chaque information manquante → valeur par défaut, et le dire (le plan liste « Valeurs par défaut appliquées »).
- Jamais de publication, jamais de suppression de rushs.
- Aucun texte inventé : titres, noms et appels à l'action viennent de l'utilisateur.

## Critères de qualité
Début qui entre dans le sujet, aucune phrase coupée, pauses raccourcies mais présentes, fin intentionnelle (fondu), son à la cible de la plateforme, sous-titres dans la zone sûre.

## Exemple
« Monte mes 3 rushs de cuisine pour Reels, 45 s » → `run cuisine --input input/cuisine --profile culinaire --preset reels --duration 45`.

## Ne pas utiliser
Pour du motion design pur sans rushs, de l'effet spécial image par image, ou pour télécharger des vidéos depuis une plateforme.
