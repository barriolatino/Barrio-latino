---
name: export-optimization
description: Choix et réglage des formats d'export : TikTok, Reels, Shorts, YouTube, publicité, formation, interview, archive ; résolution, débit, loudness, conversion d'orientation.
---

# Export

Presets : `presets/export.toml` (`style --list`). Plusieurs formats : `export <projet> --preset tiktok,youtube`.

## Règles
- Vertical 1080×1920 30 i/s ; horizontal 1920×1080 cadence source standardisée ; archive CRF 12 à la résolution source.
- H.264 High, yuv420p, BT.709, AAC 48 kHz, `+faststart` ; débit plafonné (`maxrate`) pour les plateformes.
- Conversion d'orientation : arrière-plan flouté par défaut ; recadrage seulement si le sujet est localisé avec confiance (signalé) ; jamais de déformation.
- Durée au-delà du maximum d'un format → erreur explicite et proposition d'une version courte, pas de coupe silencieuse.
- Chaque export : MP4 + SRT/VTT + audio de contrôle + timeline JSON + rapport qc + LIVRAISON.md.

## Ne pas utiliser
Pour publier : aucune publication automatique, la livraison attend `approve`.
