---
description: Lister, afficher ou reprendre un projet
argument-hint: [list | show <projet>]
---

Exécute depuis la racine du dépôt :

```bash
python3 video-studio/studio.py project $ARGUMENTS
```

Si une étape est « en cours » ou « échec », propose de reprendre avec `python3 video-studio/studio.py run <projet>` (la reprise réutilise analyses et segments déjà calculés).

Règles : réponds en français ; ne prétends jamais qu'une fonctionnalité a fonctionné si la commande a échoué (cite le message d'erreur et sa piste de résolution) ; aucune publication sur une plateforme ; ne supprime jamais un rush. Voir `video-studio/README.md`.
