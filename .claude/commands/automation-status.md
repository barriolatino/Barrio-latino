---
description: État de toutes les automatisations (tâches planifiées, hooks, scripts)
---
1. `list_triggers` (claude-code-remote) : pour chaque tâche planifiée, nom, horaire (fuseau), activée ou non, dernière exécution (statut), prochaine exécution, conversation de rattachement (actuelle ou autre).
2. Comparer avec `memory/AUTOMATIONS.md` et `~/.claude/global-memory/GLOBAL_AUTOMATIONS.md` : signaler les tâches présentes d'un seul côté.
3. Hooks : `.claude/settings.json` du projet. Processus d'arrière-plan éventuels de la conversation en cours.
4. Tableau court : nom, état, dernière, prochaine, erreur, action nécessaire. Mettre à jour `memory/AUTOMATION_STATE.md` (date UTC) puis commit et push de ce seul fichier.
Ne rien activer, désactiver ni relancer.
