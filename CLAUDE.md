# Barrio Latino — site vitrine

Restaurant latino-américain à Clermont-Ferrand. Site statique d'une seule page
(`index.html`), publié par GitHub Pages sur la branche `main`.

## Contraintes

- Tout le site tient dans `index.html` : structure, styles et scripts inclus.
- Les 12 images sont encodées en base64 dans le fichier (1,71 Mo, soit 97 % du
  poids total). Toute image ajoutée de cette façon alourdit chaque visite, sans
  mise en cache possible. Préférer des fichiers séparés dans `assets/`.
- Le trafic vient surtout du lien en bio Instagram, donc mobile : le poids de la
  page est le premier critère de qualité.

## Outillage Claude Code

Les 5 outils sont déclarés dans `.claude/settings.json`. Pour les réinstaller
dans une nouvelle session cloud : `bash setup-claude-toolchain.sh`.

Arbitrage entre outils qui réclament la priorité en début de session :

1. **superpowers** est injecté automatiquement ; ses skills de processus
   (`brainstorming`, `systematic-debugging`) passent avant l'implémentation.
2. **task-observer** seulement pour une tâche réellement multi-étapes
   (~15k tokens par invocation) — jamais pour une question simple.
3. **impeccable** prend la main sur tout travail de design frontend.

`claude-mem` fonctionne uniquement par hooks et ne s'invoque pas manuellement.

## Catalogue de l'épicerie (`catalogue/`)

Application Next.js séparée du site vitrine (base PostgreSQL, administration).
Elle ne passe pas par GitHub Pages : elle se déploie sur Vercel (Root Directory
`catalogue`). Voir `catalogue/README.md` et `docs/catalogue/00-cadrage.md`.

- Next.js 16 : lire `catalogue/node_modules/next/dist/docs/` avant d'utiliser une API
  (proxy.ts au lieu de middleware, `revalidateTag(tag, profile)`, params asynchrones).
- Toute écriture publique passe par `src/lib/products.ts` (historique des prix,
  révisions, texte de recherche) puis `revalidateCatalogue()`.
- Vérifier avant de pousser : `npm run typecheck && npm run lint && npm run test:e2e`.

## Studio de montage vidéo (`video-studio/`)

Chaîne de montage automatisée (FFmpeg + Python), indépendante du site et du catalogue.
Point d'entrée : `python3 video-studio/studio.py help` ; commandes Claude Code `/video-*`
(`.claude/commands/`) et skills associées (`.claude/skills/`). Voir `video-studio/README.md`.

- Ne jamais modifier ni supprimer les rushs ; aucune publication automatique (validation via `approve`).
- Médias et projets (`input/`, `projects/`, `exports/`) ne sont pas versionnés.
- Vérifier avant de pousser : `cd video-studio && python3 -m pytest -q` (rend et relit de vraies vidéos).
