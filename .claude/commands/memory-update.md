---
description: Mettre à jour la mémoire (globale si préférence générale, locale si état ou décision du projet)
argument-hint: [ce qui a changé]
---
Changement à enregistrer : $ARGUMENTS (sinon, déduire des derniers échanges).

- Préférence générale (vaut pour tous les projets) → `~/.claude/global-memory/GLOBAL_CONTEXT.md` ou `GLOBAL_PREFERENCES.md` + une ligne dans `GLOBAL_CHANGELOG.md`.
- Propre au projet → `memory/` : décision (`DECISIONS.md`), tâche (`TASKS.md`), état (`SESSION_STATE.md`), automatisation (`AUTOMATIONS.md` / `AUTOMATION_STATE.md`), préférence locale (`USER_PREFERENCES.md`).
- Modifier la ligne concernée plutôt qu'ajouter un doublon ; signaler une contradiction avec une décision existante.
- Jamais de secret. Commit des seuls fichiers de mémoire et push.
Réponse : une ligne par fichier modifié.
