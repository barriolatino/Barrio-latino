---
description: Tio Clem — génère de nouvelles idées et les ajoute à la banque
argument-hint: <nombre d'idées>
---
Génère **$ARGUMENTS** nouvelles idées Tio Clem (20 par défaut) et ajoute-les à la banque.

1. Lis `tio-clem/PLAYBOOK.md` (§27–28), puis lance `python3 tio-clem/tools/factory.py bank` : catégories sous-représentées, angles et intentions déjà utilisés.
2. `python3 tio-clem/tools/factory.py combine 40 --json` : combinaisons SUJET + ANGLE + FORMAT + PUBLIC + ÉMOTION jamais utilisées. Les titres sont des brouillons.
3. Choisis les meilleures, en privilégiant les catégories sous-représentées et les intentions rares. Tu peux aussi proposer des thèmes entièrement nouveaux. Réécris chaque titre pour qu'il soit naturel, précis et vérifiable (ex. « Pourquoi le ceviche peut surprendre un Français lors de sa première dégustation ? »).
4. Ajoute-les à `tio-clem/content/ideas.json` au format des idées existantes (ne supprime jamais une idée) : `id` suivant, `title`, `category`, `pillar` (voir `tio-clem/config/content-pillars.json`), `format`, `difficulty` (easy/medium/hard), `visual_potential`, `educational_potential`, `conversation_potential`, `originality` (1–5), `last_used: null`, `status: "available"`, plus les champs internes `theme`, `subject`, `angle`, `angle_type`, `sub_category`, `filming_required`, `scores_10` (7 notes /10), `usage: []`, `origin: "generee"`. Si le thème est nouveau, ajoute-le à `tio-clem/content/topics.json`.
5. Vérifie avec `python3 tio-clem/tools/factory.py bank` (aucun problème de schéma) et affiche la liste ajoutée (sans les scores : ils restent internes).
