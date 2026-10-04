---
name: subtitle-design
description: Sous-titrage : transcription, découpage lisible, typographie française, styles, SRT/VTT, mots incertains. Utiliser pour générer, corriger ou juger des sous-titres.
---

# Sous-titres

Moteurs : fichier `.srt/.vtt` fourni à côté du rush (prioritaire) ; faster-whisper si un modèle est configuré (`VSTUDIO_WHISPER_MODEL`) ; pocketsphinx (anglais seulement, qualité modeste) ; sinon pas de sous-titres automatiques, et le système le dit.

## Règles appliquées
- 2 lignes maximum, longueur par style (26 car. dynamique, 42 sobre), coupe équilibrée après ponctuation ou avant un mot de liaison, pas de mot orphelin.
- 1 à 6 s par sous-titre, ≤ 20 caractères/seconde (contrôlé), pas de chevauchement, jamais deux plans dans le même sous-titre.
- Français : espace fine insécable avant `; ! ?`, insécable avant `:` et dans `« »`, apostrophe typographique.
- **Aucun mot inventé.** Les mots à faible confiance vont dans `subtitles/a_verifier.txt`. Correction : éditer `transcripts/<rush>.json` avec le texte donné par l'utilisateur, `"edited_by_user": true`.
- Styles : sobre, dynamique, cinematique, interview, educatif, publicitaire (`captions --style`).

## Contrôle
Rendu réel des sous-titres seuls → aucun pixel hors cadre ni dans les marges de la plateforme ; correction automatique de la taille si besoin.

## Ne pas utiliser
Pour traduire : la traduction n'est pas implémentée.
