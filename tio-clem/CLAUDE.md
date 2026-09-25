# Tio Clem — Content Factory

Production semi-autonome de publications TikTok pour **Tio Clem (@tioclem15)** :
le Pérou expliqué simplement par un Français passionné par le pays.
L'utilisateur **valide puis publie**. Le pipeline s'arrête à `READY_TO_PUBLISH` :
**jamais de publication automatique sur TikTok.**

## À lire avant toute production

1. `config/brand.json` : ton, identité, ce qu'on évite.
2. `PLAYBOOK.md` : règles éditoriales détaillées (recherche, hooks, histoire, culture, sous-titres…).
3. `config/source-policy.json` : quelles sources, dans quel ordre.
4. `config/production.json` : statuts, contrôles critiques, politique MOCK.

## Règles absolues

- Ne jamais inventer une source, une URL, un chiffre ou une citation. Une URL citée a été ouverte.
- Une légende ou une hypothèse est toujours annoncée comme telle.
- Ne jamais simuler une API ni inventer une clé : les clés vont dans `.env` (voir `.env.example`).
- Un asset MOCK ne sert qu'aux tests : il interdit `READY_TO_PUBLISH`.
- Ne jamais déclarer une fonctionnalité terminée sans l'avoir testée, et ne jamais dire qu'un fichier existe sans l'avoir vérifié.
- Musique : aucune musique commerciale ajoutée automatiquement.
- Idées : on ne supprime jamais une idée de `content/ideas.json`, on change son `status`.
- Rotation : jamais 3 publications de suite dans la même catégorie ; jamais deux fois le même thème avec le même type d'angle.

## Où est quoi

| Chemin | Contenu |
|---|---|
| `config/` | marque, piliers, styles vidéo et carrousel, politique de sources, production |
| `content/ideas.json` | les 202 idées (statut, pilier, notes internes) |
| `content/topics.json` | les thèmes (clé anti-répétition) |
| `content/angles.json` | types d'angle, publics, émotions, intentions |
| `content/calendar.json` | les 30 premiers jours |
| `content/published.json` | historique et statistiques |
| `content/posts/day-NN.json` | script, scènes ou slides, SEO, description d'un post |
| `research/<slug>.json` | recherche sourcée d'un sujet |
| `tools/` | moteur Python (`factory.py`, `content/`, `research/`, `render.py`), tests (`check.py`, `tests/`) |
| `templates/` | gabarits vidéo, carrousel, cover |
| `assets/` | polices, tes voix (`audio/voice/`), tes photos (`images/posts/`), musiques libres |
| `output/` | rendus de travail ; `posts/` : dossiers finaux (Phase 5) |
| `analytics/metrics.csv` | statistiques TikTok (analyse en V2) |

## Commandes

`/create [nombre|sujet]`, `/create-day [jour]`, `/daily`, `/batch [n]`, `/research [sujet]`,
`/idea [n]`, `/review`, `/calendar`, `/export`, `/month`, plus `/pick`, `/bank`, `/stats`
(définies dans `.claude/commands/` à la racine du dépôt).

## Moteur

```bash
bash setup.sh                     # dépendances Python (Pillow, imageio-ffmpeg, pyspellchecker)
npm test                          # tests de structure + tests unitaires
python3 tools/factory.py calendar # état du calendrier
python3 tools/factory.py draft 3  # squelette + pré-contrôle anti-répétition
python3 tools/factory.py research-check <slug>   # politique de sources
python3 tools/factory.py lint 3   # structure et style oral du script
python3 tools/factory.py build 3  # rendu + contrôle qualité du jour 3
```

## Dépôt

Le projet est autonome : il fonctionne à la racine de n'importe quel dépôt (commandes dans
`.claude/commands/`, chemins relatifs au projet). `bash tools/move-to-own-repo.sh <dossier> [url]`
l'extrait du dépôt Barrio-latino avec son historique.

## Avancement V2

| Phase | Contenu | État |
|---|---|---|
| 1 | architecture, config, base de contenu, commandes, docs, `.env.example` | fait |
| 2 | recherche (`tools/research/`), sélection, anti-répétition, script (`tools/content/`) | fait |
| 3 | visuels (Mode A / Mode B), TTS, sous-titres | à faire |
| 4 | FFmpeg, templates vidéo, cover | à faire (existant V1 à brancher sur `templates/`) |
| 5 | contrôle qualité (`quality-report.json`), export vers `posts/` | à faire |
| 6 | test « 5 choses que tu ne savais probablement pas sur le ceviche péruvien » | à faire |
