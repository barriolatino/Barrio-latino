---
description: Reprendre le projet depuis la mémoire (globale + locale) et vérifier l'état réel
---
Protocole de reprise. Lectures ciblées uniquement.

1. Mémoire globale : `~/.claude/global-memory/` ; si absente, chercher `*/claude-studio/global-memory/` et lancer `bash <ce dossier>/installer.sh`. Lire `GLOBAL_CONTEXT.md` et `GLOBAL_PREFERENCES.md`.
2. Projet courant (`$CLAUDE_PROJECT_DIR` ou dépôt de travail) : lire `CLAUDE.md` (déjà chargé), puis `memory/HANDOFF.md`, `memory/SESSION_STATE.md`, `memory/TASKS.md` (sections « En cours » et « À faire »), `memory/AUTOMATION_STATE.md`.
3. Vérifier le réel : `git status --short`, `git log --oneline -5`, existence des fichiers cités dans HANDOFF, et `list_triggers` (outil claude-code-remote) pour les tâches planifiées : actives, dernière exécution, prochaine, conversation de rattachement.
4. Signaler tout écart entre mémoire et réel (sans le corriger en silence).
5. Résumé en 8 lignes au plus : projet, dernière étape terminée, état, en cours, problèmes connus, automatisations actives, suspendues ou en erreur, prochaine action recommandée.
Ne rien relancer, ne rien recréer, ne rien publier à ce stade.
