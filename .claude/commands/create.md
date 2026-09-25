---
description: Tio Clem — crée une publication sur un sujet libre, ou les N prochaines du calendrier
argument-hint: <nombre> | <sujet>
---
Argument reçu : **$ARGUMENTS**

Lis d'abord `tio-clem/CLAUDE.md` et `tio-clem/PLAYBOOK.md`.

**Si l'argument est un nombre N (ou vide = 1)** : crée les N prochaines publications. Pour chacune, `python3 tio-clem/tools/factory.py next` donne le prochain jour non produit (le calendrier d'abord, puis la meilleure idée de la banque), puis suis exactement `.claude/commands/create-day.md` pour ce jour. Relis `tio-clem/content/published.json` avant chaque publication pour éviter les répétitions entre elles.

**Si l'argument est un sujet** (ex. « la chicha morada ») :
1. Cherche dans `tio-clem/content/ideas.json` une idée `available` qui correspond au sujet. S'il n'y en a pas, ajoute-la (id suivant, tous les champs du schéma, `origin: "demande"`), avec un thème existant de `tio-clem/content/topics.json` ou un nouveau thème.
2. Vérifie l'anti-répétition : si ce thème a déjà été publié avec le même type d'angle, choisis un autre angle et dis-le.
3. Le jour de publication est le prochain jour libre après le dernier jour produit. Suis `.claude/commands/create-day.md` pour ce jour, avec cette idée.

Termine par un récapitulatif : jour, sujet, statut, dossier de sortie, points à vérifier.
