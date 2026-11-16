---
description: Reprendre les automatisations interrompues ou rattachées à une ancienne conversation, sans doublon
---
1. Faire `/automation-status` (état réel d'abord).
2. Pour chaque tâche planifiée :
   - activée, exécutions réussies, rattachée à cette conversation → ne rien faire ;
   - activée mais rattachée à une autre conversation → elle fonctionne toujours (ses comptes rendus arrivent là-bas). Proposer de la rattacher ici ; seulement après accord : `create_trigger` avec le même nom, horaire et prompt (lu par `get_trigger`), sans `persistent_session_id` (= cette conversation), vérifier qu'elle existe, puis `update_trigger enabled=false` sur l'ancienne. Jamais deux copies actives ; jamais de suppression sans accord ;
   - désactivée ou en échec → donner la cause (`last_run`, `ended_reason`, `suspension_reason`) et la correction ; réactiver seulement après accord si elle publie, envoie ou dépense.
3. Vérifier les dépendances avant toute reprise : dépôts clonés aux chemins attendus, connecteurs (Gmail, Agenda, Windsor, Firecrawl…), scripts présents.
4. Mettre à jour `memory/AUTOMATION_STATE.md` (et `AUTOMATIONS.md` si un identifiant change), commit et push.
