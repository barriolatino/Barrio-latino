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

## Tio Clem : Content Factory (`tioclem/`)

Le dossier `tioclem/` est un projet séparé du site : la production des publications
TikTok du compte Tio Clem (@tioclem15) sur le Pérou. Il ne touche pas à `index.html`.

- Règles éditoriales : `tioclem/PLAYBOOK.md`, à lire avant toute production.
- Commandes : `/create`, `/create-day`, `/batch`, `/calendar`, `/idea`, `/research`,
  `/review`, `/export`, `/month`, `/daily`, `/pick`, `/bank`, `/stats` (dans `.claude/commands/`).
- Banque d'idées : `tioclem/content/topics.json` et `angles.json` ; jamais 3 posts de suite
  dans la même catégorie, jamais deux fois le même thème avec le même angle.
- Dépendances : `bash tioclem/setup.sh`.
- Ne jamais publier sur TikTok ; ne jamais écrire un fait sans source dans `tioclem/research/`.
