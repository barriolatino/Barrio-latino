---
description: Tio Clem — crée les N prochaines publications non produites du calendrier
argument-hint: <nombre de publications, 1 par défaut>
---
Crée les **$ARGUMENTS** prochaines publications Tio Clem (1 si aucun nombre n'est donné).

Pour chacune : `python3 tioclem/factory.py next` donne le prochain jour non produit, puis suis exactement la procédure de `.claude/commands/create-day.md` pour ce jour. Relis `tioclem/content/published.json` avant chaque nouvelle publication pour éviter les répétitions entre elles.

`/create 1` crée le contenu du jour, `/create 5` crée 5 publications.

Termine par un récapitulatif : jour, sujet, statut, dossier de sortie, points à vérifier.
