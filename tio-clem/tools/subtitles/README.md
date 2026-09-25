# Sous-titres

`srt.py` : découpage en morceaux lisibles, calage sur la voix (débit réel en syllabes,
accroche aux reprises de parole), fichier `subtitles.srt`, contrôle de lisibilité :

| Règle | Niveau |
|---|---|
| 2 lignes maximum, 30 caractères par ligne | erreur |
| chevauchement, durée nulle, texte après la fin | erreur |
| affichage de moins de 0,6 s | avertissement |
| plus de 20 caractères par seconde | avertissement |

Incrustation : libass via ffmpeg (`tools/render.py`), texte blanc cerné de noir, dans la zone
sûre TikTok (`config/video-style.json`).
