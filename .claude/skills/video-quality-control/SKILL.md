---
name: video-quality-control
description: Contrôle qualité d'une vidéo exportée : intégrité, conformité, durée, synchronisation, son, noirs, figés, sous-titres, fin. Utiliser avant toute livraison.
---

# Contrôle qualité

Commande : `python3 video-studio/studio.py quality <projet>` (fait aussi automatiquement après chaque rendu).

## Vérifications réelles (qc.py)
Décodage complet ; H.264/AAC/yuv420p, résolution, cadence, rotation ; durée vs timeline (±0,2 s) ; durée max de la plateforme ; écart audio/vidéo (≤ 100 ms) ; présence de son ; EBU R128 (±1,5 LU) et crête vraie ; écrêtage ; parole présente là où la timeline la prévoit ; début et fin du son ; écrans noirs hors fondus ; images figées > 2 s ; sauts de luminosité hors coupes ; dernière image fondue ; sous-titres rendus seuls → bords et marges ; vitesse de lecture ; taille ; planche contact.

## Corrections automatiques (au plus 2 tours)
Taille des sous-titres réduite de 15 % ; cible de normalisation corrigée de l'écart mesuré ; limiteur abaissé. Tout le reste → validation humaine (une correction qui touche au contenu n'est jamais automatique).

## Ta part
Ouvre la planche contact avec Read et décris ce que tu vois. Classe : bloquant / réserve / à vérifier humainement. Ne dis jamais « prêt à publier » : dis « prêt pour validation ».

## Ne pas utiliser
Comme garantie éditoriale : le contrôle ne juge pas le sens.
