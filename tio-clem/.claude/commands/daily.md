---
description: Tio Clem — produit automatiquement le prochain jour non produit
---
> Chemins relatifs à la racine du projet Tio Clem (le dossier qui contient `config/brand.json`). Dans le dépôt Barrio-latino, fais d'abord `cd tio-clem`.

Mode automatique :

1. `python3 tools/factory.py next` : identifie le prochain jour non produit et son sujet (calendrier, puis banque d'idées une fois les 30 jours faits).
2. Suis `.claude/commands/create-day.md` pour ce jour : recherche, création, contrôle, export des fichiers.
3. Le jour passe à `READY_TO_PUBLISH` dans `content/published.json` quand le contrôle qualité est entièrement vert.
4. Commite les fichiers produits sur la branche de travail.

Ne publie **jamais** sur TikTok : la dernière vérification et la publication restent humaines. Termine par le résumé : ce qui a été créé, les sources, les fichiers, les points à vérifier.
