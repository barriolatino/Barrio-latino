# Architecture

## Principes

- **Outils réels et locaux** : FFmpeg/FFprobe pour tout le traitement image/son, Python (bibliothèque
  standard + numpy) pour l'orchestration et les mesures. Aucune API payante, aucun service externe
  obligatoire.
- **Modules remplaçables** : chaque étape lit et écrit des fichiers JSON documentés. Le moteur de
  transcription, par exemple, est choisi parmi plusieurs adaptateurs (`analysis/transcribe.py`).
- **Traçabilité** : toutes les décisions sont écrites (timeline JSON avec la raison de chaque plan, plan
  lisible en Markdown, journal du projet, rapports d'analyse et de contrôle).
- **Reprise** : chaque étape a un état persistant et une clé de cache ; un rendu interrompu ne laisse
  pas de fichier final incomplet (écriture `.part` puis renommage atomique).

## Modules (`vstudio/`)

| Module | Rôle |
|---|---|
| `ffmpeg.py` | exécution FFmpeg, sondage (`probe` : rotation, cadence variable, orientation), décodage d'intégrité, lecture d'images et d'audio en numpy |
| `config.py` | presets TOML : export, profils éditoriaux (héritage `extends`, profils personnalisés), couleur, sous-titres |
| `project.py` | dossier de projet, `project.json`, journal, états d'étapes, versions de timeline |
| `ingest.py` | étape 1 — vérification, empreinte, rejet motivé, transcription fournie (`.srt`) |
| `analysis/audio.py` | activité sonore (seuil adaptatif), pauses, EBU R128, saturation, bruit ; tempo et temps forts d'une musique |
| `analysis/visual.py` | plans (scdet), luminance, contraste, netteté (laplacien), mouvement, tremblements (corrélation de phase), sujet, dominante, vignettes |
| `analysis/transcribe.py` | fourni / faster-whisper / pocketsphinx ; mots horodatés, confiance, phrases |
| `analysis/runner.py` | étape 2 — orchestration, prises répétées, doublons, rôles des rushs, scores, rapport |
| `planner.py` | étapes 3–4 — brief, unités (phrases, fenêtres d'illustration), assemblage, accroche, plans de coupe, calage musical, recadrage, plan Markdown |
| `render.py` | étapes 5–8 — segments en cache, filtres couleur/recadrage/voix, assemblage, mixage + ducking + loudness, passe finale |
| `subtitles.py` | découpage, typographie, SRT/VTT/ASS, titres, intervenants, filigrane, liste des mots incertains |
| `qc.py` | étape 9 — contrôle du fichier produit, planche contact, rapport |
| `pipeline.py` | enchaînement, reprise, corrections automatiques (étape 10), multi-formats, livraison (étapes 11–12), validation |
| `revise.py` | révisions en langage naturel, révisions locales, variantes |
| `reference.py` | mesures de vidéos de référence, bibliothèque de principes |
| `ui.py` | interface web locale |
| `demo.py` | médias de test synthétiques (images FFmpeg, voix Flite, musique synthétisée) |
| `cli.py` | commandes |

## Données d'un projet

- `project.json` : réglages (`profile`, `presets`, `target_duration`, `music`, `lang`, `title`, `end_text`,
  `speakers`, `overrides`…), rushs (chemin d'origine, empreinte, métadonnées, statut), étapes
  (`statut`, `clé`, date), versions de timeline, rendus, validation.
- `timeline/vNNN.json` : `clips[]` avec `rush`, `in`, `out`, `kind` (parole / illustration / teaser), `reason`,
  `text`, `cutaways[]`, `reframe`, `crop_x`, `speed`, `audio`, `gain_db`, `transition_in`, `flags[]` ;
  plus `brief`, `params` (profil résolu), `music`, `decisions[]`, `flags[]`, dimensions, cadence.
  Ce fichier est **modifiable à la main** : `preview --version N` le rend tel quel.
- `transcripts/rNN.json` : segments et mots horodatés avec confiance ; `"edited_by_user": true` protège
  une correction manuelle d'une nouvelle analyse.

## Rendu

1. Segment par plan (`cache/seg_<clé>.mkv`, H.264 CRF 12 + PCM) : `fps` constant → recadrage
   (plein / flou / recadrage / cadre) → couleur → voix (passe-haut 75 Hz, `afftdn` 3–15 dB, compresseur
   2,2:1, gain d'égalisation) → micro-fondus 12 ms. La clé contient tous les paramètres du plan.
2. Assemblage : concat sans réencodage, ou `xfade`/`acrossfade` si fondus.
3. Audio : musique en boucle, volume piloté par une expression de ducking calculée sur les passages
   parlés (rampes 0,35 s) ; mesure `loudnorm`, puis normalisation linéaire + limiteur → WAV de contrôle.
4. Passe finale : fondus, `ass=` (sous-titres + habillage), H.264 High / yuv420p / BT.709 / AAC,
   `+faststart`.

## Contrôle qualité (`qc.py`)

Intégrité (décodage complet) · conformité (codecs, résolution, cadence, rotation, pixels) · durée ·
durée max plateforme · écart audio/vidéo · présence de son · EBU R128 · crête vraie · écrêtage ·
parole présente aux endroits prévus · début et fin du son · écrans noirs hors fondus · images
figées · sauts de luminosité hors coupes · dernière image fondue · sous-titres hors cadre (rendus
réellement, seuls, sur fond noir) · marges de la plateforme · vitesse de lecture · taille · planche
contact. Corrections automatiques : taille des sous-titres, cible de normalisation, limiteur.

## Remplacer un moteur

- Transcription : ajouter une fonction dans `analysis/transcribe.py` qui renvoie
  `{"engine", "provenance", "lang", "segments": [{start, end, text, words: [{w, start, end, conf}], uncertain}]}`
  et l'enregistrer dans `choose_engine`.
- Détection de plans : `analysis/visual.scene_cuts` (renvoie une liste de temps).
- Rendu : `render.render_segment` / `final_encode` ; un moteur de templates (Remotion) pourrait
  produire des incrustations à superposer dans la passe finale.
