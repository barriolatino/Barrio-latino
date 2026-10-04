---
name: motion-design
description: Habillage et animation sobre : titres, lower thirds, cartons de fin, filigrane de prévisualisation, fondus. Utiliser pour ajouter des textes à l'écran ou juger leur pertinence.
---

# Motion design (habillage)

Implémenté (libass via sous-titres ASS) : titre d'ouverture (`--title`), identification d'intervenant (`--speaker r01="Nom — fonction"`), texte de fin (`--end-text`), fondus d'apparition 300–400 ms, fondus au noir d'entrée/sortie, filigrane « PRÉVISUALISATION ».

Non implémenté à ce jour (ne pas le promettre) : flèches, encadrements, cartes, graphiques, barres de progression, masques, recadrages animés, arrêt sur image, flou de mouvement. Remotion n'est pas utilisé : à envisager seulement si un besoin de templates animés est confirmé.

## Règles
- Pas d'animation à chaque plan ; un texte n'apparaît que s'il apporte une information.
- Textes uniquement fournis par l'utilisateur, en respectant la typographie.
- Placement dans les zones sûres de la plateforme ; ne jamais masquer un visage ou un produit.
- Polices : DejaVu Sans / Liberation Sans (libres). Toute autre police → `assets/fonts/` avec sa licence.

## Ne pas utiliser
Pour générer des images ou des scènes : le système ne crée pas de contenu visuel.
