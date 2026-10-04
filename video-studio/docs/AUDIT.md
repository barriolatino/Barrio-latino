# Audit initial (phase 0) — 4 octobre 2026

## Dépôt

- Site vitrine statique `index.html` (GitHub Pages, branche `main`) et application Next.js `catalogue/`
  (Vercel). Aucun outil vidéo existant.
- `.claude/settings.json` : plugins superpowers, task-observer, impeccable, claude-mem. Pas de skill
  ni de commande de projet. Rien n'a été écrasé : le studio vit dans `video-studio/`, les commandes
  dans `.claude/commands/video-*.md`, les skills dans `.claude/skills/`.

## Environnement constaté

| Élément | État |
|---|---|
| FFmpeg / FFprobe | 6.1.1, libx264, libass, freetype, libflite, filtres loudnorm, ebur128, scdet, blackdetect, freezedetect, sidechaincompress, afftdn, xfade, eq, colortemperature, lut3d |
| Python | 3.11 (tomllib) ; numpy installé via PyPI |
| Node | 22 (Remotion possible mais non retenu : pas de besoin justifié pour le MVP) |
| Réseau | PyPI accessible ; **huggingface.co bloqué** (modèles Whisper indisponibles ici) |
| Polices | DejaVu, Liberation, FreeFont (licences libres) |
| CPU | 4 cœurs, 15 Go de RAM, pas de GPU |

## Choix techniques

- **FFmpeg** pour tout (décodage, analyse par filtres, rendu, mesures), via un wrapper unique.
- **numpy** pour les mesures image/son sur des images réduites (rapide, sans OpenCV).
- **scdet** (FFmpeg) pour la détection de plans plutôt que PySceneDetect : déjà présent, suffisant.
- **libass** pour sous-titres et habillage (typographie, contours, boîtes, fondus) au lieu de
  `drawtext` : meilleure qualité et pas de problèmes d'échappement.
- **Transcription** : adaptateurs. pocketsphinx (BSD, modèle anglais inclus dans le paquet) est le
  seul moteur exécutable ici ; faster-whisper (MIT) est intégré pour le multilingue dès qu'un modèle
  est accessible ; les `.srt` fournis sont prioritaires.
- **Interface** : serveur HTTP de la bibliothèque standard, sans framework.
- **Médias de test** : entièrement synthétiques (sources FFmpeg, voix Flite, musique par formule),
  provenance documentée.
- Non retenus pour l'instant : OpenCV (inutile au niveau de mesure actuel), Remotion (pas de templates
  animés indispensables), API payantes (le traitement local suffit).
