---
description: Tio Clem — enregistre les statistiques TikTok d'une publication
argument-hint: <jour> vues likes commentaires partages enregistrements [rétention %]
---
Enregistre les statistiques de la publication : **$ARGUMENTS**.

Traduis ce que donne l'utilisateur en :
`python3 tio-clem/tools/factory.py stats <jour> --vues N --likes N --commentaires N --partages N --enregistrements N [--retention P] [--published AAAA-MM-JJ]`

Le jour passe à `PUBLISHED`. Ensuite, si au moins 3 publications ont des statistiques, lance `python3 tio-clem/tools/factory.py bank` et commente brièvement ce qui marche le mieux (catégories, angles, formats) et ce que ça change pour les prochains sujets.
