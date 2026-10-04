---
name: audio-post-production
description: Post-production audio : niveaux, débruitage modéré, compression légère, normalisation EBU R128, ducking musique sous la voix, contrôle des crêtes. Utiliser pour tout problème ou réglage de son.
---

# Post-production audio

Chaîne réelle (render.py) : passe-haut 75 Hz → débruitage `afftdn` 3–15 dB selon `denoise` et le bruit mesuré → compression 2,2:1 → égalisation des niveaux entre rushs (voix ≈ -20 LUFS avant mixage) → micro-fondus de 12 ms à chaque coupe → musique avec ducking calculé sur les passages parlés (rampes 0,35 s) → normalisation EBU R128 en deux passes (linéaire) → limiteur → audio de contrôle WAV.

## Règles
- Débruitage modéré (≤ 0,4) : au-delà, voix métallique. Préférer garder un peu de bruit.
- Ne pas écraser la dynamique : compression légère seulement.
- Cibles : -14 LUFS réseaux/YouTube, -16 LUFS formation/interview ; crête vraie ≤ -1 à -1,5 dBTP.
- Musique : uniquement fournie par l'utilisateur, avec `--music-provenance`. Réglages : `audio --music-level -14 --duck -12`.
- Ambiances des plans d'illustration conservées (niveau ≈ -30 LUFS).

## Contrôle
Rapport qc : intensité, crête vraie, saturation, cohérence parole/timeline, début et fin du son. Écouter l'audio de contrôle en cas de doute.

## Ne pas utiliser
Pour restaurer un enregistrement très dégradé (outil dédié nécessaire) ou séparer des voix.
