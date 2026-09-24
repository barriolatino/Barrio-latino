---
description: Tio Clem — génère de nouvelles idées et les ajoute à la banque
argument-hint: <nombre d'idées>
---
Génère **$ARGUMENTS** nouvelles idées Tio Clem (20 par défaut) et ajoute-les à la banque.

1. Lis `tioclem/PLAYBOOK.md` (§27–28), puis lance `python3 tioclem/factory.py bank` : catégories sous-représentées, angles et intentions déjà utilisés.
2. `python3 tioclem/factory.py combine 40 --json` : combinaisons SUJET + ANGLE + FORMAT + PUBLIC + ÉMOTION jamais utilisées. Les titres sont des brouillons.
3. Choisis les meilleures, en privilégiant les catégories sous-représentées et les intentions rares. Tu peux aussi proposer des thèmes entièrement nouveaux. Réécris chaque titre pour qu'il soit naturel, précis et vérifiable (ex. « Pourquoi le ceviche peut surprendre un Français lors de sa première dégustation ? »).
4. Ajoute-les à `tioclem/content/topics.json` au format des idées existantes : id suivant (`202` → `203`…), `categorie`, `sous_categorie`, `theme`, `sujet`, `angle`, `type_angle`, `format`, `difficulte`, `tournage_requis`, les 7 `scores` /10, `score_total`, `utilisations: []`, `derniere_utilisation: null`, `origine: "generee"`.
5. Vérifie avec `python3 tioclem/factory.py bank` (aucun problème de schéma) et affiche la liste ajoutée (sans les scores : ils restent internes).
