---
description: Exporter la version finale (sans publier)
argument-hint: <projet> [--preset a,b] [--version N]
---

Exécute depuis la racine du dépôt :

```bash
python3 video-studio/studio.py export $ARGUMENTS
```

Présente les fichiers, leurs caractéristiques et le statut du contrôle qualité, puis la liste « à vérifier ». Rappelle que rien n'est publié et que la validation se fait avec /video-quality puis `python3 video-studio/studio.py approve <projet> --by "Nom"`. Ne lance jamais approve toi-même sans que l'utilisateur te donne son nom et son accord explicite.

Règles : réponds en français ; ne prétends jamais qu'une fonctionnalité a fonctionné si la commande a échoué (cite le message d'erreur et sa piste de résolution) ; aucune publication sur une plateforme ; ne supprime jamais un rush. Voir `video-studio/README.md`.
