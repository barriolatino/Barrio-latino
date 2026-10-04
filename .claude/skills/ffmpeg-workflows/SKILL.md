---
name: ffmpeg-workflows
description: Recettes FFmpeg fiables pour l'analyse, le rendu et le diagnostic vidéo/audio (ffprobe, filtres, encodage H.264/AAC). Utiliser pour déboguer un rendu ou étendre video-studio.
---

# Workflows FFmpeg

Wrapper : `vstudio/ffmpeg.py` (`run`, `probe`, `decode_check`, `read_gray_frames`, `read_audio_mono`). Toujours passer par lui (journalisation, erreurs en français).

## Recettes éprouvées dans le projet
- Analyse : `ffprobe -show_format -show_streams -of json` ; rotation via `side_data_list.rotation` ; cadence variable via horodatages (`-show_entries packet=pts_time -read_intervals %+10`).
- Plans : `scale=320:-2,scdet=threshold=10` ; noirs : `blackdetect=d=0.4:pix_th=0.08` ; figés : `freezedetect=n=0.001:d=2`.
- Loudness : `loudnorm=print_format=json` (mesure) puis passe linéaire `measured_*` ; vérification `ebur128=peak=true`.
- Segments : `-ss` avant `-i` (précis en réencodage), `fps=N` pour une cadence constante, x264 CRF 12 + PCM en MKV comme intermédiaires.
- Sortie : `-pix_fmt yuv420p -profile:v high -colorspace bt709 -movflags +faststart`, écriture `.part` puis renommage atomique.
- Sous-titres : filtre `ass=` avec chemin échappé (`ffmpeg_escape_path`).

## Règles
- Ne jamais considérer qu'un rendu est bon parce que FFmpeg a renvoyé 0 : relire le fichier (`qc.py`).
- Pas d'option qui écrase les rushs (`-y` uniquement vers des fichiers de travail).

## Ne pas utiliser
Pour des opérations destructives sur `input/`.
