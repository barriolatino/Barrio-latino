---
name: color-grading
description: Correction colorimétrique automatique simple : exposition, dominante, contraste, saturation, profils (naturel, cinématique, chaud, froid, noir et blanc…). Utiliser pour harmoniser des plans ou changer l'ambiance.
---

# Couleur

Réalité de l'outil : correction automatique simple par rush (filtres FFmpeg `eq`, `colorbalance`, `colortemperature`), pas un étalonnage professionnel plan par plan. Le dire à l'utilisateur.

## Ce qui est fait
1. Exposition : gamma corrigé si la luminance moyenne est < 75 ou > 175 (bornes 0,88–1,25).
2. Dominante : neutralisée à 45 % si modérée (4–22 %) ; une dominante forte (coucher de soleil) est considérée comme voulue.
3. Profil : contraste, saturation, température, ombres/hautes lumières (`presets/color.toml`).

## Règles
- Saturation ≤ 1,08 hors demande explicite ; jamais de netteté artificielle.
- Peaux : éviter les profils froids extrêmes sur les visages.
- Culinaire : `culinaire` (chaleur légère, couleurs fidèles).
- Changer : `python3 video-studio/studio.py color <projet> --profile chaud`.

## Contrôle
Planche contact + contrôle « changements de luminosité anormaux ».

## Ne pas utiliser
Pour des LUT de marque non fournies, ou corriger un plan précis à la main (outil de montage dédié).
