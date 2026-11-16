---
description: Passation complète avant de changer de conversation (audit, mémoire, automatisations, prompt de reprise)
---
Protocole de passation pour chaque dépôt touché pendant la conversation.

1. Audit : `git status --short`, `git log --oneline` depuis la dernière passation, tâches faites ou non, décisions prises, bugs, tests lancés, processus d'arrière-plan encore actifs (ne pas les tuer), `list_triggers` (statut, dernière et prochaine exécution, conversation de rattachement).
2. Mémoire locale (`memory/`), mises à jour ciblées sans recopie : `SESSION_STATE.md` (remplacé), `TASKS.md`, `DECISIONS.md` et `CHANGELOG.md` (ajouts datés), `AUTOMATIONS.md` si une automatisation a changé, `AUTOMATION_STATE.md` (état vérifié, date et heure UTC).
3. Mémoire globale : seulement si une préférence générale a changé (+ ligne dans `GLOBAL_CHANGELOG.md`). Jamais d'information propre à un projet.
4. Réécrire `memory/HANDOFF.md` (60 lignes au plus) : projet, objectif, contexte indispensable, état, dernières actions, fichiers importants, décisions, tâches terminées / en cours / restantes, problèmes, tests, automatisations (actives, suspendues, à reprendre, prochaines exécutions), dépendances, prochaine action exacte, consignes.
5. Contrôle : aucun secret écrit (`grep -niE "sk-|token|password|mot de passe" memory/`), dates cohérentes, fichiers cités existants.
6. Commit des seuls fichiers de mémoire (« Mémoire : passation du AAAA-MM-JJ ») et push sur la branche de travail du dépôt ; en session cloud, sans push tout est perdu.
7. Afficher le prompt de reprise ci-dessous, prêt à copier :

```
/resume
Reprends le travail là où la conversation précédente s'est arrêtée : charge la mémoire globale et memory/ du projet, lis HANDOFF.md, vérifie l'état réel (git, fichiers, tâches planifiées), ne refais rien de terminé, ne crée aucun doublon, respecte les décisions enregistrées, puis continue directement avec la « prochaine action » du HANDOFF. Si des tâches planifiées sont rattachées à l'ancienne conversation, propose /automation-resume sans rien changer avant mon accord.
```
