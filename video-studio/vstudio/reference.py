"""Analyse de vidéos de référence et bibliothèque de principes éditoriaux.

On mesure la structure d'une vidéo fournie par l'utilisateur (qu'il est autorisé
à utiliser) : rythme des plans, délai avant la première coupe et la première
parole, densité de parole, niveau sonore. Seules ces mesures sont conservées :
ni images, ni texte, ni son de la vidéo ne sont copiés dans la bibliothèque.
Aucun téléchargement depuis une plateforme n'est fait par ce module.
"""

from __future__ import annotations

import datetime as dt
import json
import tomllib
from pathlib import Path

import numpy as np

from . import config, ffmpeg
from .analysis import audio as A
from .analysis import visual as V
from .project import atomic_write_text, slugify


def principles() -> list[dict]:
    with open(config.PRESETS_DIR / "principes_editoriaux.toml", "rb") as f:
        return tomllib.load(f)["principe"]


def analyze_reference(video: str, name: str | None = None, source: str = "") -> dict:
    p = Path(video)
    info = ffmpeg.probe(p)
    cuts = V.scene_cuts(str(p))
    bounds = [0.0] + [c for c in cuts if 0.05 < c < info.duration - 0.05] + [info.duration]
    shots = np.diff(bounds)
    m = {"durée_s": round(info.duration, 2), "format": f"{info.display_width}×{info.display_height} ({info.orientation})",
         "plans": len(shots), "durée_moyenne_plan_s": round(float(shots.mean()), 2),
         "durée_médiane_plan_s": round(float(np.median(shots)), 2),
         "plan_le_plus_court_s": round(float(shots.min()), 2), "plan_le_plus_long_s": round(float(shots.max()), 2),
         "coupes_par_minute": round(len(cuts) / max(info.duration / 60, 1e-6), 1),
         "première_coupe_s": round(cuts[0], 2) if cuts else None,
         "variation_rythme": round(float(shots.std() / max(shots.mean(), 1e-6)), 2)}
    if info.has_audio:
        a = A.analyze_audio(str(p), info.duration)
        regions = a.get("active_regions", [])
        m["son_actif_pct"] = round(a.get("active_ratio", 0) * 100)
        m["premier_son_s"] = regions[0][0] if regions else None
        m["pauses_longues_>1s"] = sum(1 for x, y in a.get("pauses", []) if y - x > 1.0)
        m["intensité_LUFS"] = a.get("loudness", {}).get("integrated_lufs")
    thirds = [round(float(np.mean([s for s, b in zip(shots, bounds) if lo <= b < hi] or [0])), 2)
              for lo, hi in ((0, info.duration / 3), (info.duration / 3, 2 * info.duration / 3),
                             (2 * info.duration / 3, info.duration + 1))]
    m["durée_plan_par_tiers_s"] = thirds
    obs = []
    if m["première_coupe_s"] is not None and m["première_coupe_s"] < 2:
        obs.append("première coupe très tôt : début rythmé")
    if m["variation_rythme"] > 0.6:
        obs.append("rythme varié (plans courts et longs alternés)")
    elif m["plans"] > 3:
        obs.append("rythme régulier")
    if thirds[0] and thirds[2] and thirds[2] > thirds[0] * 1.3:
        obs.append("les plans s'allongent vers la fin (conclusion posée)")
    if m.get("premier_son_s") is not None and m["premier_son_s"] < 0.5:
        obs.append("son présent dès le début")
    slug = slugify(name or p.stem)
    out_dir = config.workspace() / "references"
    out_dir.mkdir(parents=True, exist_ok=True)
    rec = {"nom": name or p.stem, "fichier": p.name, "source_et_autorisation": source or "non précisée — à compléter",
           "analysé_le": dt.date.today().isoformat(), "mesures": m, "observations": obs,
           "note": "Mesures structurelles uniquement ; aucun contenu de la vidéo n'est conservé."}
    atomic_write_text(out_dir / f"{slug}.json", json.dumps(rec, indent=2, ensure_ascii=False))
    md = [f"# Référence : {rec['nom']}", "", f"Source / autorisation : {rec['source_et_autorisation']}", "",
          "| Mesure | Valeur |", "|---|---|"] + [f"| {k} | {v} |" for k, v in m.items()]
    md += ["", "Observations (à transformer en principes généraux, sans copier le montage) :"]
    md += [f"- {o}" for o in obs] or ["- aucune observation marquante"]
    atomic_write_text(out_dir / f"{slug}.md", "\n".join(md) + "\n")
    rec["report"] = str(out_dir / f"{slug}.md")
    return rec
