---
description: Construire le plan de montage (timeline)
argument-hint: <projet> [--profile X] [--preset a,b] [--duration N] [--music fichier] [--variants N]
---

Exécute depuis la racine du dépôt :

```bash
python3 video-studio/studio.py edit $ARGUMENTS
```

Lis le plan produit (timeline/plan_vXXX.md) et explique la structure (accroche, développement, fin), les décisions et les points « à vérifier par un humain ». Si l'utilisateur n'a pas fourni de musique, ne va pas en chercher : rappelle seulement qu'il peut en fournir une dont il a les droits.

Règles : réponds en français ; ne prétends jamais qu'une fonctionnalité a fonctionné si la commande a échoué (cite le message d'erreur et sa piste de résolution) ; aucune publication sur une plateforme ; ne supprime jamais un rush. Voir `video-studio/README.md`.
