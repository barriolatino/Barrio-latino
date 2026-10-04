# Installation

## Prérequis

- **FFmpeg ≥ 6** avec libx264, libass, libfreetype (paquet `ffmpeg` d'Ubuntu/Debian, Homebrew sur macOS).
  Vérification : `python3 studio.py doctor`.
- **Python ≥ 3.11** (utilise `tomllib`).
- `pip install -r requirements.txt`

## Transcription (sous-titres automatiques)

Par ordre de qualité :

1. **Fichier fourni** : un `.srt` ou `.vtt` portant le même nom que la vidéo, dans le même dossier.
   Toujours prioritaire. Idéal si vous disposez déjà d'une transcription relue.
2. **faster-whisper** (multilingue, détection de langue, MIT) : `pip install faster-whisper`, puis un
   modèle local. Les modèles sont hébergés sur Hugging Face ; si votre réseau y a accès :
   ```bash
   export VSTUDIO_WHISPER_MODEL=small        # téléchargé automatiquement au premier usage
   ```
   Sinon, copiez un dossier de modèle CTranslate2 (ex. `faster-whisper-small`) et indiquez son chemin :
   `export VSTUDIO_WHISPER_MODEL=/chemin/vers/faster-whisper-small`.
   Modèle conseillé sur CPU : `small` (français correct, ≈ 0,5× temps réel sur 4 cœurs) ; `medium`
   pour plus de précision.
3. **pocketsphinx** (BSD, hors ligne, modèle anglais inclus) : uniquement pour l'anglais, qualité
   modeste (les mots douteux sont listés dans `subtitles/a_verifier.txt`).

Sans moteur adapté à la langue, le montage fonctionne quand même (les coupes suivent l'activité
sonore, sans jamais couper un son) mais sans sous-titres automatiques ; le plan le signale.

> Environnement Claude Code dans le cloud : l'accès à `huggingface.co` peut être bloqué par la
> politique réseau de l'environnement. Ajoutez ce domaine à la liste autorisée dans les réglages de
> l'environnement pour utiliser Whisper, ou fournissez des `.srt`.

## Polices, musiques, logos

- Polices par défaut : DejaVu Sans (licence libre Bitstream Vera) et Liberation Sans (SIL OFL), déjà
  présentes sur la plupart des systèmes Linux. Une police déposée dans `assets/fonts/` est utilisée
  par le rendu ; joignez sa licence.
- Musique : uniquement des fichiers dont vous avez les droits. Indiquez l'origine avec
  `--music-provenance` : elle est reportée dans la fiche de livraison.

## Claude Code

Les commandes `/video-*` (`.claude/commands/`) et les skills (`.claude/skills/`) sont versionnées dans
le dépôt. Elles appellent `python3 video-studio/studio.py`.
