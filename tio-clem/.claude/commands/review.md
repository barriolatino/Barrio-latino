---
description: Tio Clem — revérifie les publications produites
argument-hint: <jour, ou vide pour toutes>
---
> Chemins relatifs à la racine du projet Tio Clem (le dossier qui contient `config/brand.json`). Dans le dépôt Barrio-latino, fais d'abord `cd tio-clem`.

Revérifie les publications Tio Clem : `python3 tools/factory.py review $ARGUMENTS` (toutes si vide).

Puis relis toi-même, pour chaque publication : exactitude par rapport à `research/<slug>.json`, orthographe et grammaire du script, de la description et du texte à l'écran, naturel à l'oral, absence de généralisation abusive, pas de légende présentée comme un fait, pas de gagnant désigné dans un contenu interactif.

Corrige automatiquement ce qui doit l'être dans `content/posts/day-NN.json` et relance `python3 tools/factory.py build NN`. Termine par un tableau : jour, statut, problèmes trouvés, corrections faites, points restant pour un humain.
