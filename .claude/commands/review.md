---
description: Tio Clem — revérifie les publications produites
argument-hint: <jour, ou vide pour toutes>
---
Revérifie les publications Tio Clem : `python3 tioclem/factory.py review $ARGUMENTS` (toutes si vide).

Puis relis toi-même, pour chaque publication : exactitude par rapport à `research/<slug>.json`, orthographe et grammaire du script, de la description et du texte à l'écran, naturel à l'oral, absence de généralisation abusive, pas de légende présentée comme un fait, pas de gagnant désigné dans un contenu interactif.

Corrige automatiquement ce qui doit l'être dans `tioclem/content/posts/day-NN.json` et relance `python3 tioclem/factory.py build NN`. Termine par un tableau : jour, statut, problèmes trouvés, corrections faites, points restant pour un humain.
