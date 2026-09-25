---
description: Tio Clem — produit automatiquement le prochain jour non produit
---
Mode automatique :

1. `python3 tio-clem/tools/factory.py next` : identifie le prochain jour non produit et son sujet (calendrier, puis banque d'idées une fois les 30 jours faits).
2. Suis `.claude/commands/create-day.md` pour ce jour : recherche, création, contrôle, export des fichiers.
3. Le jour passe à `READY_TO_PUBLISH` dans `tio-clem/content/published.json` quand le contrôle qualité est entièrement vert.
4. Commite les fichiers produits sur la branche de travail.

Ne publie **jamais** sur TikTok : la dernière vérification et la publication restent humaines. Termine par le résumé : ce qui a été créé, les sources, les fichiers, les points à vérifier.
