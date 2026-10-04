---
description: Importer et vérifier des rushs dans un projet
argument-hint: <projet> [fichiers ou dossiers…]
---

Exécute depuis la racine du dépôt :

```bash
python3 video-studio/studio.py import $ARGUMENTS
```

Résume pour chaque fichier : accepté ou rejeté (avec la raison), durée, orientation, son, avertissements (rotation, cadence variable, absence d'audio). Ne modifie ni ne déplace jamais les rushs.

Règles : réponds en français ; ne prétends jamais qu'une fonctionnalité a fonctionné si la commande a échoué (cite le message d'erreur et sa piste de résolution) ; aucune publication sur une plateforme ; ne supprime jamais un rush. Voir `video-studio/README.md`.
