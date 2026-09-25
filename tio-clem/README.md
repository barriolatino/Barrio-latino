# Tio Clem — Content Factory 🇵🇪

Machine de production semi-autonome pour le compte TikTok **Tio Clem (@tioclem15)**,
« le Pérou expliqué simplement par un Français passionné par le pays ».

```
IDÉE → RECHERCHE → VÉRIFICATION → ANGLE → SCRIPT → STORYBOARD → VISUELS → VOIX
     → SOUS-TITRES → MONTAGE → COUVERTURE → DESCRIPTION → HASHTAGS
     → CONTRÔLE QUALITÉ → READY_TO_PUBLISH          (toi : VALIDER → PUBLIER)
```

La publication sur TikTok reste manuelle, volontairement.

## Démarrer

```bash
cd tio-clem
bash setup.sh        # Pillow, ffmpeg (imageio-ffmpeg), correcteur français
npm test             # vérifie config, base d'idées, commandes, .env.example
cp .env.example .env # seulement si tu branches un fournisseur payant (TTS, images)
```

Sans `.env`, tout fonctionne en local et gratuitement : cartes graphiques Tio Clem,
ta propre voix, ffmpeg local.

## Commandes (Claude Code)

| Commande | Effet |
|---|---|
| `/create 3` | crée les 3 prochaines publications |
| `/create la chicha morada` | crée une publication sur ce sujet |
| `/create-day 14` | crée le jour 14 du calendrier |
| `/daily` | produit le prochain jour non produit |
| `/batch 7` | produit 7 publications en série |
| `/research sujet` | fait uniquement la recherche |
| `/idea 20` | ajoute 20 idées à la banque |
| `/review` | revérifie les publications produites |
| `/calendar` | affiche le calendrier |
| `/export` | rassemble les publications prêtes |
| `/month` | prépare un mois complet |
| `/pick`, `/bank`, `/stats` | choix d'idées, équilibre du fil, statistiques TikTok |

## Architecture

```
tio-clem/
├── CLAUDE.md, README.md, PLAYBOOK.md, .env.example, .gitignore, package.json, setup.sh
├── config/      brand, content-pillars, video-style, carousel-style, source-policy, production
├── content/     ideas (202), topics (thèmes), angles, calendar (30 j), published, posts/
├── research/    une recherche sourcée par sujet
├── posts/       dossiers finaux par publication (Phase 5)
├── assets/      images, videos, audio (tes voix), music (libre de droits), fonts
├── templates/   video, carousel, cover
├── tools/       factory.py, bank.py, render.py, check.py + un dossier par module
├── analytics/   metrics.csv (statistiques TikTok)
└── output/      rendus de travail
```

## Les 8 piliers

🍽️ Manger le Pérou · 🏛️ Comprendre le Pérou · 🗺️ Explorer le Pérou · 🎉 Vivre le Pérou ·
🗣️ Parler comme un Péruvien · 🤯 Découvrir l'insolite · 😋 Goûter le Pérou · 💬 Participer

Chaque idée de `content/ideas.json` est rattachée à un pilier (`config/content-pillars.json`).

## Fournisseurs et coûts

Par défaut, tout est local et gratuit. Les fournisseurs payants (TTS, images générées)
se choisissent dans `.env` et s'ajoutent en Phase 3 derrière une interface commune, pour
pouvoir en changer sans toucher au reste. Le mode `MOCK` sert uniquement aux tests et
bloque le statut `READY_TO_PUBLISH`.

## Avancement

Voir le tableau « Avancement V2 » dans [`CLAUDE.md`](CLAUDE.md).
