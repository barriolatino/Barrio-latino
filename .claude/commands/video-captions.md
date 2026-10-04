---
description: Générer, afficher ou corriger les sous-titres
argument-hint: <projet> [--style X] [--scale 0.9] [--on|--off] [--lang fr] [--show]
---

Exécute depuis la racine du dépôt :

```bash
python3 video-studio/studio.py captions $ARGUMENTS
```

Montre le contenu de subtitles/a_verifier.txt s'il existe. N'invente jamais un mot : si une correction est demandée, modifie transcripts/<rush>.json uniquement avec le texte donné par l'utilisateur, ajoute "edited_by_user": true, puis relance la commande.

Règles : réponds en français ; ne prétends jamais qu'une fonctionnalité a fonctionné si la commande a échoué (cite le message d'erreur et sa piste de résolution) ; aucune publication sur une plateforme ; ne supprime jamais un rush. Voir `video-studio/README.md`.
