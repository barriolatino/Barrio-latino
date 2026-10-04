"""Étape 2 — Analyse des rushs et rapport.

Résultat par rush : analysis/<id>.json (réutilisé à la reprise si le rush n'a
pas changé), transcription modifiable dans transcripts/<id>.json, vignettes et
un rapport lisible analysis/rapport_analyse.md.
"""

from __future__ import annotations

import difflib
import json
import re
from pathlib import Path

import numpy as np

from ..project import Project, atomic_write_text, stable_hash
from . import audio as A
from . import transcribe as T
from . import visual as V

ANALYSIS_VERSION = 3


def analyze(project: Project, force: bool = False) -> dict:
    log = project.log
    rushes = project.usable_rushes()
    if not rushes:
        from ..errors import ProjectError
        raise ProjectError("Aucun rush exploitable dans le projet.",
                           hint="Importez des vidéos avec « import » avant l'analyse.")
    lang = project.settings.get("lang") or "auto"
    results = {}
    for r in rushes:
        out = project.path("analysis", f"{r['id']}.json")
        key = stable_hash([r["fingerprint"], ANALYSIS_VERSION, lang])
        if out.exists() and not force:
            data = json.loads(out.read_text(encoding="utf-8"))
            if data.get("key") == key:
                log.info(f"• {r['id']} {r['name']} : analyse déjà faite (reprise)")
                results[r["id"]] = data
                continue
        log.info(f"• Analyse de {r['id']} {r['name']} …")
        info = r["info"]
        data = {"key": key, "rush": r["id"], "name": r["name"], "duration": info["duration"]}
        if info["has_audio"]:
            data["audio"] = A.analyze_audio(r["path"], info["duration"], log)
        else:
            data["audio"] = {"present": False}
        data["visual"] = V.analyze_visual(r["path"], info["duration"], log)
        regions = data["audio"].get("active_regions", []) if data["audio"].get("present") else []
        sidecar = project.path("transcripts", r["sidecar_transcript"]) if r.get("sidecar_transcript") else None
        tr = T.transcribe(r["path"], lang, regions, sidecar) if (regions or sidecar) else \
            {"engine": None, "segments": [], "note": "aucune activité sonore notable (ambiance seulement)"}
        tr_path = project.path("transcripts", f"{r['id']}.json")
        if tr_path.exists() and json.loads(tr_path.read_text(encoding="utf-8")).get("edited_by_user"):
            log.info("    transcription corrigée à la main conservée")
            tr = json.loads(tr_path.read_text(encoding="utf-8"))
        else:
            atomic_write_text(tr_path, json.dumps(tr, indent=2, ensure_ascii=False))
        data["transcript_engine"] = tr.get("engine")
        data["transcript_note"] = tr.get("note", "")
        data["speech_segments"] = len(tr.get("segments", []))
        data["thumbnails"] = V.thumbnails(r["path"], data["visual"].get("shots", []),
                                          project.path("analysis", "vignettes"), r["id"])
        atomic_write_text(out, json.dumps(data, indent=2, ensure_ascii=False))
        results[r["id"]] = data
        _log_summary(log, data)

    summary = summarize(project, results)
    atomic_write_text(project.path("analysis", "synthese.json"), json.dumps(summary, indent=2, ensure_ascii=False))
    write_report(project, results, summary)
    project.journal(f"Analyse terminée : {len(results)} rush(s). Rapport : analysis/rapport_analyse.md")
    return summary


def _log_summary(log, d: dict) -> None:
    a, v = d["audio"], d["visual"]
    parts = [f"{len(v.get('shots', []))} plan(s)"]
    if a.get("present"):
        parts.append(f"son actif {a['active_ratio'] * 100:.0f} %")
    if d["speech_segments"]:
        parts.append(f"{d['speech_segments']} phrase(s) transcrite(s) [{d['transcript_engine']}]")
    log.info("    " + ", ".join(parts))
    for i in a.get("issues", []):
        log.info(f"    ⚠ audio : {i}")
    if d.get("transcript_note"):
        log.info(f"    ℹ {d['transcript_note']}")


def load_transcript(project: Project, rush_id: str) -> dict:
    p = project.path("transcripts", f"{rush_id}.json")
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"segments": []}


def _norm(t: str) -> str:
    return re.sub(r"[^\w ]", "", t.lower()).strip()


def find_retakes(segments: list[dict], window: float = 45.0) -> list[dict]:
    """Prises répétées : deux phrases proches et très semblables → on garde la dernière."""
    out = []
    for i, s in enumerate(segments):
        for j in range(i + 1, len(segments)):
            t = segments[j]
            if t["start"] - s["end"] > window:
                break
            a, b = _norm(s["text"]), _norm(t["text"])
            if len(a) < 12 or len(b) < 12:
                continue
            ratio = difflib.SequenceMatcher(None, a, b).ratio()
            if ratio >= 0.65:
                out.append({"drop": i, "keep": j, "similarity": round(ratio, 2),
                            "text": s["text"][:80]})
                break
    return out


def summarize(project: Project, results: dict) -> dict:
    """Synthèse projet : rôle de chaque rush, scores des plans, doublons, prises répétées."""
    sharp = [s["sharpness"] for d in results.values() for s in d["visual"].get("shots", [])]
    motion = [s["motion"] for d in results.values() for s in d["visual"].get("shots", [])]
    med_sharp = float(np.median(sharp)) if sharp else 1.0
    med_motion = float(np.median(motion)) if motion else 1.0
    rushes = {}
    for rid, d in results.items():
        tr = load_transcript(project, rid)
        segs = tr.get("segments", [])
        a = d["audio"]
        speech_time = sum(s["end"] - s["start"] for s in segs)
        active = a.get("active_ratio", 0) if a.get("present") else 0
        if segs and speech_time / max(d["duration"], 1) > 0.2:
            role, kind = "parole", "prise de parole (interview, face caméra, explication)"
        elif segs:
            role, kind = "mixte", "plans avec un peu de parole"
        elif active > 0.35 and not tr.get("engine") and not tr.get("note", "").startswith("aucune activité"):
            role, kind = "son_actif", "son continu (parole non vérifiée : transcription indisponible)"
        else:
            mean_motion = d["visual"].get("mean_motion", 0)
            role = "illustration"
            kind = "plans d'action / illustration" if mean_motion > med_motion * 0.8 else "plans d'ambiance / établissement"
        shots = []
        for s in d["visual"].get("shots", []):
            issues = list(s["issues"])
            if s["sharpness"] < 0.35 * med_sharp and s["sharpness"] < 40:
                issues.append("probablement flou")
            pen = 0.0
            for i in issues:
                pen += {"image noire ou quasi noire": 1.0, "image figée": 0.5, "sous-exposé": 0.25,
                        "surexposé (hautes lumières brûlées)": 0.25, "instable (tremblements)": 0.25,
                        "probablement flou": 0.15}.get(i, 0.1)
            tech = max(0.0, 1.0 - pen)
            interest = float(1 - np.exp(-s["motion"] / (med_motion + 1e-6))) if med_motion > 0 else 0.5
            score = round(0.65 * tech + 0.35 * interest, 3)
            shots.append({**{k: s[k] for k in ("index", "start", "end", "motion", "sharpness", "luma",
                                                "subject_x", "subject_confidence")},
                          "issues": issues, "tech": round(tech, 2), "score": score})
        retakes = find_retakes(segs) if project.state["settings"].get("overrides", {}).get("remove_retakes", True) else []
        rushes[rid] = {"role": role, "kind": kind, "speech_time": round(speech_time, 2),
                       "shots": shots, "retakes": retakes,
                       "audio_issues": a.get("issues", []),
                       "uncertain_words": sum(len(s.get("uncertain", [])) for s in segs),
                       "color_cast": d["visual"].get("color_cast", {}),
                       "mean_luma": d["visual"].get("mean_luma"),
                       "loudness": a.get("loudness", {})}
    # doublons visuels entre plans de rushs différents
    dups = []
    items = [(rid, s) for rid, d in results.items() for s in d["visual"].get("shots", [])]
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            (ra, sa), (rb, sb) = items[i], items[j]
            if ra == rb:
                continue
            va, vb = np.array(sa["signature"]), np.array(sb["signature"])
            if va.size and va.size == vb.size and np.abs(va - vb).mean() < 6 and va.std() > 5:
                dups.append({"a": f"{ra} plan {sa['index'] + 1}", "b": f"{rb} plan {sb['index'] + 1}"})
    return {"rushes": rushes, "duplicates": dups, "median_sharpness": med_sharp, "median_motion": med_motion}


def _fmt(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:04.1f}"


def write_report(project: Project, results: dict, summary: dict) -> Path:
    lines = [f"# Rapport d'analyse des rushs — {project.state['name']}", "",
             "Les scores guident le montage, ils ne remplacent pas le jugement éditorial. "
             "Aucun rush n'est supprimé : les passages « à éviter » restent disponibles.", ""]
    for rid, d in results.items():
        r = project.rush(rid)
        info, s = r["info"], summary["rushes"][rid]
        a = d["audio"]
        lines += [f"## {rid} — {r['name']}", "",
                  "| Élément | Valeur |", "|---|---|",
                  f"| Durée | {info['duration']:.1f} s |",
                  f"| Image | {info['display_width']}×{info['display_height']} ({info['orientation']}), "
                  f"{info['fps']:.2f} i/s{' variable' if info['vfr'] else ''}, {info['vcodec']} |",
                  f"| Son | {('oui, ' + info['acodec']) if info['has_audio'] else 'aucun'} |",
                  f"| Contenu probable | {s['kind']} |"]
        if a.get("present") and a.get("loudness"):
            ld = a["loudness"]
            if ld.get("integrated_lufs") is not None:
                lines.append(f"| Niveau sonore | {ld['integrated_lufs']:.1f} LUFS, crête {ld['true_peak_dbtp']:.1f} dBTP, "
                             f"bruit de fond ≈ {a['noise_floor_db']:.0f} dBFS |")
        lines.append(f"| Transcription | {d['transcript_engine'] or 'aucune'}"
                     f"{' — ' + d['transcript_note'] if d.get('transcript_note') else ''} |")
        good = [x for x in s["shots"] if x["score"] >= 0.6 and not x["issues"]]
        bad = [x for x in s["shots"] if x["issues"]]
        lines += ["", f"**Qualité technique moyenne** : {np.mean([x['tech'] for x in s['shots']]) * 100:.0f} %"
                  if s["shots"] else "", ""]
        if good:
            lines.append("**Passages recommandés** : " + ", ".join(
                f"{_fmt(x['start'])}–{_fmt(x['end'])}" for x in sorted(good, key=lambda x: -x["score"])[:6]))
        if bad:
            lines.append("**Passages à éviter ou vérifier** : " + "; ".join(
                f"{_fmt(x['start'])}–{_fmt(x['end'])} ({', '.join(x['issues'])})" for x in bad[:8]))
        if s["audio_issues"]:
            lines.append("**Problèmes audio** : " + "; ".join(s["audio_issues"]))
        if s["retakes"]:
            lines.append("**Prises répétées** (la dernière est gardée) : " + "; ".join(
                f"« {x['text']}… » ({x['similarity'] * 100:.0f} %)" for x in s["retakes"]))
        if s["uncertain_words"]:
            lines.append(f"**Mots incertains à vérifier** : {s['uncertain_words']} (voir transcripts/{rid}.json)")
        use = {"parole": "colonne vertébrale du montage (A-roll) ; ordre des phrases respecté",
               "mixte": "séquence principale avec parole ponctuelle",
               "son_actif": "traité comme de la parole par prudence (aucune coupe au milieu d'un son)",
               "illustration": "plans d'illustration (B-roll), ouverture ou respirations"}[s["role"]]
        lines += [f"**Utilisation recommandée** : {use}", ""]
        if d.get("thumbnails"):
            lines.append(" ".join(f"![]({'vignettes/' + t})" for t in d["thumbnails"][:8]))
            lines.append("")
    if summary["duplicates"]:
        lines += ["## Doublons probables", ""] + [f"- {x['a']} ≈ {x['b']}" for x in summary["duplicates"]] + [""]
    p = project.path("analysis", "rapport_analyse.md")
    atomic_write_text(p, "\n".join(lines))
    return p
