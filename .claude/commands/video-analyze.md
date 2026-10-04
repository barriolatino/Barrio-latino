---
description: Analyser les rushs d'un projet
argument-hint: <projet> [--force]
---

Exécute depuis la racine du dépôt :

```bash
python3 video-studio/studio.py analyze $ARGUMENTS
```

Lis ensuite video-studio/projects/<projet>/analysis/rapport_analyse.md et présente : contenu probable de chaque rush, passages recommandés, passages à éviter, problèmes audio/vidéo, prises répétées, mots incertains. Regarde quelques vignettes (analysis/vignettes/) avec l'outil Read pour confirmer ce que disent les chiffres.

Règles : réponds en français ; ne prétends jamais qu'une fonctionnalité a fonctionné si la commande a échoué (cite le message d'erreur et sa piste de résolution) ; aucune publication sur une plateforme ; ne supprime jamais un rush. Voir `video-studio/README.md`.
