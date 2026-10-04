# Guide d'utilisation

Toutes les commandes se lancent depuis `video-studio/` : `python3 studio.py <commande>`.
Dans Claude Code, les mêmes actions existent en `/video-<commande>`.

## 1. Déposer les rushs

Créez `input/<projet>/` et copiez-y vos vidéos (MP4, MOV, MKV…). Les originaux ne sont jamais
modifiés : le projet garde seulement leur chemin et une empreinte. Si vous avez une transcription,
déposez `ma-video.srt` à côté de `ma-video.mp4`.

```bash
python3 studio.py import recette             # lit input/recette/
python3 studio.py import recette ~/Videos/rush1.mov ~/Videos/rush2.mov
```

Chaque fichier est vérifié (décodage réel) ; un fichier corrompu est rejeté avec la raison, sans
bloquer les autres.

## 2. Analyser

```bash
python3 studio.py analyze recette
```

Rapport : `projects/recette/analysis/rapport_analyse.md` (contenu probable, qualité, passages
recommandés / à éviter, problèmes audio, prises répétées, mots incertains, vignettes).

## 3. Choisir le style

```bash
python3 studio.py style --list                         # profils, formats, couleurs, sous-titres
python3 studio.py style recette --profile culinaire
python3 studio.py style recette --set pause_keep=0.5 --set transition=fondu
python3 studio.py style recette --save-as ma-cuisine   # profil personnalisé réutilisable
```

Sans choix, le profil est déduit des rushs et annoncé comme « valeur par défaut ».

## 4. Monter

```bash
python3 studio.py edit recette --preset reels,youtube --duration 45 \
        --music assets/music/guitare.mp3 --music-provenance "Bibliothèque X, licence Y" \
        --title "Empanadas maison" --end-text "Réservez au 04 …" --speaker r01="Ana — cheffe"
python3 studio.py edit recette --variants 3            # trois propositions (v00N)
```

Le plan lisible : `projects/recette/timeline/plan_v001.md` (chaque plan avec sa raison, décisions,
points à vérifier). La timeline `v001.json` peut être modifiée à la main.

## 5. Prévisualiser

```bash
python3 studio.py preview recette                      # format principal
python3 studio.py preview recette --version 3 --preset tiktok
```

La prévisualisation (demi-résolution, filigrane) est contrôlée automatiquement : rapport
`qc/*_qc.md` + planche contact `qc/*_planche.jpg`.

## 6. Corriger

```bash
python3 studio.py revise recette "Fais un montage plus dynamique"
python3 studio.py revise recette "Les sous-titres sont trop grands" --preview
python3 studio.py revise recette "Supprime le plan c07"
python3 studio.py revise recette "Fais une version de 30 secondes"
```

Formulations reconnues : plus dynamique / plus lent, supprime les longueurs, garde les réactions,
début plus accrocheur, plus cinématique, musique sous les voix / plus forte / plus basse / sans
musique, sous-titres trop grands / trop petits / sans sous-titres, version de N secondes, version
TikTok et YouTube, N propositions, noir et blanc / plus chaud / plus froid, mets en valeur le
produit, fondus / coupes franches, supprime / ralentis / accélère le plan cNN. Une demande non
reconnue est refusée avec des exemples (rien n'est modifié au hasard). Chaque révision crée une
nouvelle version ; les précédentes restent dans `timeline/`.

Sous-titres : `captions recette --show` affiche la transcription ; corrigez `transcripts/r01.json`
(texte exact, `"edited_by_user": true`), puis relancez `captions` ou `preview`.

## 7. Exporter, contrôler, valider

```bash
python3 studio.py export recette                       # tous les formats du projet
python3 studio.py quality recette                      # recontrôler le dernier rendu
python3 studio.py approve recette --by "Clément" --note "OK après visionnage"
```

Dans `projects/recette/exports/` : MP4, SRT/VTT, audio de contrôle WAV, timeline utilisée, et
`LIVRAISON.md` (caractéristiques, profil, contrôle, points à vérifier). **Rien n'est publié.**

## Tout en une commande

```bash
python3 studio.py run recette --profile culinaire --preset reels --duration 45
```

Si la commande est interrompue (coupure, Ctrl+C), relancez-la à l'identique : analyses, plan et
segments déjà calculés sont réutilisés, les fichiers incomplets sont nettoyés.

## Plusieurs vidéos

```bash
python3 studio.py batch input/semaine-42 --profile reseaux_sociaux --preset reels
```

Un projet par sous-dossier (ou par fichier) ; un échec n'arrête pas le lot ; bilan final.

## Références

```bash
python3 studio.py reference ma-reference.mp4 --source "vidéo fournie par le client, usage interne"
python3 studio.py principles
```

## Interface web

`python3 studio.py ui` → http://127.0.0.1:8765 : dépôt des fichiers, style, suivi en direct,
lecture de la prévisualisation, rapport qualité, corrections, export, validation.
