---
name: social-media-editing
description: Montage vertical TikTok, Instagram Reels, YouTube Shorts : accroche, rythme, sous-titres mobiles, zones sûres, durée. Utiliser dès qu'un format vertical court est demandé.
---

# Montage pour réseaux sociaux (vertical)

Outils : profil `reseaux_sociaux`, presets `tiktok`, `reels`, `shorts`, `pub_verticale`.

## Règles concrètes
- 1080×1920, 30 i/s, -14 LUFS, sous-titres style `dynamique` (≤ 26 caractères/ligne, 2 lignes) placés au-dessus de la zone des boutons (`safe_bottom` 0,20–0,22).
- Accroche dans la première seconde **quand le sujet le permet** ; varier les accroches d'une vidéo à l'autre (teaser, meilleur plan, début naturel).
- Rythme soutenu mais variable : plans 0,9–3 s, pauses > 0,6 s ramenées à 0,25 s.
- Source horizontale : arrière-plan flouté par défaut ; recadrage seulement si le sujet est localisé avec confiance, toujours signalé « à vérifier ».
- Durée : celle du contenu utile, plafonnée par le format (pas d'étirement artificiel).

## À éviter
Zoom permanent, transitions spectaculaires à chaque coupe, sous-titres mot à mot colorés sans raison, musique qui couvre la voix.

## Exemple
`run promo --input input/promo --profile reseaux_sociaux --preset tiktok,reels --duration 30`

## Ne pas utiliser
Pour une interview longue ou un documentaire horizontal (profils `interview`, `documentaire`).
