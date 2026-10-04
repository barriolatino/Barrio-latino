---
name: viral-reference-analysis
description: Analyse de références éditoriales autorisées : rythme, accroche, durée des plans, densité de parole, et bibliothèque de principes généraux. Utiliser pour s'inspirer de vidéos performantes sans les copier.
---

# Analyse de références

Commandes : `python3 video-studio/studio.py reference <video> --source "origine et autorisation"` ; `python3 video-studio/studio.py principles`.

## Règles
- Seulement des vidéos fournies par l'utilisateur, ou dont l'usage est autorisé. Ne jamais contourner les restrictions des plateformes ni télécharger de vidéo protégée.
- On garde des **mesures** (durée des plans, coupes/min, première coupe, son actif, intensité, évolution du rythme par tiers), jamais d'images, de textes ou de sons.
- Transformer une observation en principe général et original dans `presets/principes_editoriaux.toml` : nom, contenus adaptés, pourquoi, limites, exemple original, date de vérification, confiance.
- Ne jamais promettre la viralité : on vise clarté et rétention.

## Exemple
Référence : plans médians 1,4 s, première coupe à 0,8 s, plans plus longs dans le dernier tiers → principe « accélérer l'ouverture, poser la conclusion », appliqué via `revise "Rends le début plus accrocheur"`.

## Ne pas utiliser
Pour reproduire un montage précis, ses textes, sa musique ou son identité visuelle.
