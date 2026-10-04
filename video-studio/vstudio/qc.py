"""Étape 9 — Contrôle qualité de la vidéo réellement exportée.

On n'accepte jamais un export parce que FFmpeg a fini sans erreur : le fichier est
relu, décodé, mesuré et comparé à la timeline. Résultat : qc/<nom>_qc.json et .md,
plus une planche contact (images extraites du rendu final).
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import numpy as np

from . import config, ffmpeg
from .analysis.audio import activity_regions, frame_db
from .project import Project, atomic_write_text
from .render import speech_intervals

OK, WARN, FAIL = "ok", "attention", "échec"


def _check(name, status, detail, fix=None, value=None):
    return {"check": name, "status": status, "detail": detail, "autofix": fix, "value": value}


def cut_times(timeline: dict) -> list[float]:
    t, out = 0.0, []
    for c in timeline["clips"]:
        if c["transition_in"] == "fondu":
            t -= timeline["transition_duration"]
        if t > 0:
            out.append(round(t, 3))
        t += (c["out"] - c["in"]) / c.get("speed", 1.0)
    return out


def inspect(project: Project, result: dict, timeline: dict) -> dict:
    path = Path(result["path"])
    preset = config.export_preset(result["preset"])
    preview = result["preview"]
    checks = []
    name = path.stem
    qc_dir = project.path("qc")

    # 1. présence et intégrité
    if not path.exists() or path.stat().st_size == 0:
        checks.append(_check("fichier de sortie", FAIL, "fichier absent ou vide"))
        return _finish(project, name, checks, result, timeline)
    if list(path.parent.glob(path.stem + ".part*")):
        checks.append(_check("fichier de sortie", WARN, "un fichier temporaire .part traîne à côté de l'export"))
    errs = ffmpeg.decode_check(path)
    checks.append(_check("intégrité (décodage complet)", FAIL if errs else OK,
                         "; ".join(errs[:3]) if errs else "décodage complet sans erreur"))
    info = ffmpeg.probe(path)

    # 2. conformité technique
    W, H = timeline["width"], timeline["height"]
    if preview:
        W, H = (W // 2) // 2 * 2, (H // 2) // 2 * 2
    tech = []
    if info.vcodec != "h264":
        tech.append(f"codec vidéo {info.vcodec} (attendu h264)")
    if info.acodec != "aac":
        tech.append(f"codec audio {info.acodec or 'absent'} (attendu aac)")
    if info.pix_fmt != "yuv420p":
        tech.append(f"format de pixels {info.pix_fmt}")
    if (info.display_width, info.display_height) != (W, H):
        tech.append(f"résolution {info.display_width}×{info.display_height} (attendu {W}×{H})")
    if info.rotation:
        tech.append(f"rotation résiduelle {info.rotation}°")
    if abs(info.avg_fps - timeline["fps"]) > 0.05:
        tech.append(f"cadence {info.avg_fps:.3f} i/s (attendu {timeline['fps']})")
    checks.append(_check("conformité technique", FAIL if tech else OK, "; ".join(tech) or
                         f"H.264/AAC, {W}×{H}, {info.avg_fps:.2f} i/s, yuv420p, {info.size_bytes / 1e6:.1f} Mo"))

    # 3. durée et synchronisation audio/vidéo
    expected = result["duration"]
    dd = info.duration - expected
    checks.append(_check("durée", FAIL if abs(dd) > 0.2 else OK,
                         f"{info.duration:.2f} s (attendu {expected:.2f} s, écart {dd:+.2f} s)"))
    if preset.get("max_duration") and info.duration > preset["max_duration"] + 0.5:
        checks.append(_check("durée maximale plateforme", FAIL,
                             f"{info.duration:.0f} s > {preset['max_duration']} s autorisées pour {preset['label']}"))
    av = info.audio_duration - info.video_duration
    checks.append(_check("synchronisation audio/vidéo (durées des pistes)", FAIL if abs(av) > 0.1 else OK,
                         f"écart audio − vidéo : {av * 1000:+.0f} ms"))

    # 4. audio : niveau, crêtes, saturation, cohérence parole/timeline, début et fin
    samples = ffmpeg.read_audio_mono(path, 16000)
    db = frame_db(samples)
    speech = speech_intervals(timeline)
    if samples.size == 0 or db.max() < -60:
        st = WARN if not any(project.rush(c["rush"])["info"]["has_audio"] for c in timeline["clips"]) else FAIL
        checks.append(_check("présence d'un son exploitable", st, "piste audio silencieuse"
                             + (" (attendu : aucun rush n'a de son et aucune musique)" if st == WARN else "")))
    else:
        checks.append(_check("présence d'un son exploitable", OK, f"niveau crête {db.max():.1f} dBFS (fenêtres 20 ms)"))
        ld = _ebur128(path)
        if ld:
            off = ld["I"] - preset["loudness"]
            checks.append(_check("intensité sonore (EBU R128)", WARN if abs(off) > 1.5 else OK,
                                 f"{ld['I']:.1f} LUFS (cible {preset['loudness']}), crête vraie {ld['TP']:.1f} dBTP",
                                 fix="loudness" if abs(off) > 1.5 else None, value=ld["I"]))
            if ld["TP"] > preset["true_peak"] + 0.6:
                checks.append(_check("crêtes audio", FAIL, f"crête vraie {ld['TP']:.1f} dBTP > {preset['true_peak']} dBTP",
                                     fix="true_peak", value=ld["TP"]))
        clip_ratio = float(np.mean(np.abs(samples) >= 0.999))
        checks.append(_check("saturation audio", FAIL if clip_ratio > 1e-4 else OK,
                             f"{clip_ratio * 100:.3f} % d'échantillons écrêtés"))
        if speech:
            thr = max(float(np.percentile(db, 20)) + 8, -45)
            act = activity_regions(db, thr)
            covered = sum(max(0, min(b, y) - max(a, x)) for a, b in speech for x, y in act)
            total_sp = sum(b - a for a, b in speech)
            ratio = covered / max(total_sp, 1e-6)
            checks.append(_check("cohérence parole / timeline", WARN if ratio < 0.5 else OK,
                                 f"{ratio * 100:.0f} % des passages parlés prévus contiennent bien du son"))
        tail = db[-5:].mean() if db.size > 60 else None
        if tail is not None and timeline["fade_out"] > 0:
            before = db[-60:-30].mean()
            abrupt = tail > before - 6 and tail > -40
            checks.append(_check("fin du son", WARN if abrupt else OK,
                                 "fin abrupte (pas de décroissance)" if abrupt else "décroissance de fin présente"))
        head = db[:3].mean()
        checks.append(_check("début du son", WARN if head > -20 else OK,
                             "attaque brutale dès la première image" if head > -20 else "début propre"))

    # 5. image : écrans noirs, images figées, sauts de luminosité
    black = _blackdetect(path)
    fi, fo = timeline["fade_in"], timeline["fade_out"]
    unexpected = [b for b in black if not (b[0] <= fi + 0.3 or b[1] >= info.duration - fo - 0.3)]
    checks.append(_check("écrans noirs inattendus", FAIL if unexpected else OK,
                         ", ".join(f"{a:.1f}–{b:.1f} s" for a, b in unexpected) or
                         (f"aucun (noirs de fondu attendus : {len(black)})" if black else "aucun")))
    frozen = _freezedetect(path)
    checks.append(_check("images figées", WARN if frozen else OK,
                         ", ".join(f"{a:.1f}–{b:.1f} s" for a, b in frozen) or "aucune image figée > 2 s"))
    jumps = _luma_jumps(path, cut_times(timeline))
    checks.append(_check("changements de luminosité anormaux (hors coupes)", WARN if jumps else OK,
                         ", ".join(f"{t:.1f} s" for t in jumps[:6]) or "aucun"))
    last = ffmpeg.read_gray_frames(path, 10, 64, 36, start=max(0, info.duration - 0.25))
    if last.size and fo > 0:
        lum = float(last[-1].mean())
        checks.append(_check("fin de vidéo intentionnelle", WARN if lum > 40 else OK,
                             f"dernière image {'non fondue' if lum > 40 else 'fondue au noir'} (luminance {lum:.0f})"))

    # 6. sous-titres : bords, zones de sécurité, vitesse de lecture
    sub = result.get("subtitles", {})
    if sub.get("ass_only") and sub.get("cues"):
        checks += _subtitle_checks(project, Path(sub["ass_only"]), Path(sub["srt"]), timeline, preset)

    # 7. planche contact
    sheet = qc_dir / f"{name}_planche.jpg"
    n = 12
    step = max(info.duration / n, 0.1)
    subprocess.run([ffmpeg.FFMPEG, "-hide_banner", "-nostdin", "-v", "error", "-y", "-i", str(path),
                    "-vf", f"fps=1/{step:.3f},scale=240:-2,tile=6x2:padding=4:color=white", "-frames:v", "1",
                    str(sheet)], capture_output=True)
    return _finish(project, name, checks, result, timeline, sheet if sheet.exists() else None)


def _ebur128(path: Path) -> dict | None:
    err = ffmpeg.run_filter_log(["-nostats", "-i", str(path), "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"])
    mi = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    mp = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", err)
    if not mi:
        return None
    tp = float(mp[-1]) if mp and mp[-1] != "-inf" else -99.0
    return {"I": float(mi[-1]), "TP": tp}


def _blackdetect(path: Path) -> list[tuple[float, float]]:
    err = ffmpeg.run_filter_log(["-i", str(path), "-an", "-vf", "blackdetect=d=0.4:pix_th=0.08", "-f", "null", "-"])
    return [(float(a), float(b)) for a, b in re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", err)]


def _freezedetect(path: Path) -> list[tuple[float, float]]:
    err = ffmpeg.run_filter_log(["-i", str(path), "-an", "-vf", "scale=320:-2,freezedetect=n=0.001:d=2", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"freeze_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"freeze_end: ([\d.]+)", err)]
    return list(zip(starts, ends + [float("nan")] * (len(starts) - len(ends))))


def _luma_jumps(path: Path, cuts: list[float]) -> list[float]:
    fps = 10
    fr = ffmpeg.read_gray_frames(path, fps, 64, 36)
    if len(fr) < 3:
        return []
    l = fr.reshape(len(fr), -1).mean(axis=1)
    d = np.abs(np.diff(l))
    out = []
    for i in np.where(d > 30)[0]:
        t = (i + 1) / fps
        if not any(abs(t - c) < 0.25 for c in cuts) and t > 0.5:
            out.append(round(t, 2))
    return out


def _subtitle_checks(project, ass_only: Path, srt: Path, timeline: dict, preset: dict) -> list[dict]:
    from .analysis.transcribe import parse_subtitle_file
    W, H = timeline["width"], timeline["height"]
    cues = parse_subtitle_file(srt)
    out = []
    # rendu des sous-titres seuls sur fond noir, une image au milieu de chaque sous-titre
    sw, sh = W // 2, H // 2
    bad_edge, bad_safe = [], []
    times = [(c["start"] + c["end"]) / 2 for c in cues]
    for k in range(0, len(times), 40):
        chunk = times[k:k + 40]
        sel = "+".join(f"between(t,{t - 0.02:.3f},{t + 0.02:.3f})" for t in chunk)
        proc = subprocess.run([ffmpeg.FFMPEG, "-hide_banner", "-nostdin", "-v", "error", "-f", "lavfi", "-i",
                               f"color=black:s={W}x{H}:r=25:d={max(times) + 1:.2f}",
                               "-vf", f"ass={ffmpeg.ffmpeg_escape_path(ass_only)},select='{sel}',"
                                      f"scale={sw}:{sh},format=gray",
                               "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True)
        buf = proc.stdout
        n = len(buf) // (sw * sh)
        frames = np.frombuffer(buf[: n * sw * sh], dtype=np.uint8).reshape(n, sh, sw) if n else []
        for i, f in enumerate(frames):
            lit = f > 40
            if not lit.any():
                continue
            ys, xs = np.where(lit)
            edge = int(sw * 0.01)
            idx = k + min(i, len(chunk) - 1)
            if xs.min() < edge or xs.max() > sw - edge or ys.max() > sh - edge:
                bad_edge.append(idx)
            elif (xs.min() < preset["safe_left"] * sw * 0.9 or xs.max() > sw - preset["safe_right"] * sw * 0.9
                  or ys.max() > sh - preset["safe_bottom"] * sh * 0.9):
                bad_safe.append(idx)
    out.append(_check("sous-titres dans le cadre", FAIL if bad_edge else OK,
                      f"{len(bad_edge)} sous-titre(s) touchent un bord" if bad_edge else
                      f"{len(cues)} sous-titres vérifiés sur rendu réel", fix="subtitle_size" if bad_edge else None))
    out.append(_check("sous-titres hors zones d'interface de la plateforme", WARN if bad_safe else OK,
                      f"{len(bad_safe)} sous-titre(s) débordent des marges de sécurité" if bad_safe else "marges respectées",
                      fix="subtitle_size" if bad_safe else None))
    fast = [c for c in cues if len(c["text"]) / max(c["end"] - c["start"], 0.1) > 20]
    out.append(_check("vitesse de lecture des sous-titres", WARN if fast else OK,
                      f"{len(fast)} sous-titre(s) à plus de 20 caractères/s" if fast else "≤ 20 caractères/s"))
    size_px = round(timeline.get("subtitle_scale", 1) * config.subtitle_style(timeline["subtitle_style"])["size"] * H)
    out.append(_check("taille des sous-titres", WARN if size_px < 0.026 * H else OK,
                      f"{size_px} px de corps pour {H} px de haut"))
    return out


def _finish(project, name, checks, result, timeline, sheet=None) -> dict:
    status = "échec" if any(c["status"] == FAIL for c in checks) else (
        "conforme avec réserves" if any(c["status"] == WARN for c in checks) else "conforme")
    human = list(dict.fromkeys(timeline.get("flags", [])))
    if result.get("subtitles", {}).get("to_review"):
        human.append(f"{result['subtitles']['to_review']} sous-titre(s) contiennent des mots incertains : "
                     "voir subtitles/a_verifier.txt")
    if timeline.get("music"):
        human.append("droits de la musique : " + timeline["music"]["provenance"])
    human.append("regarder la vidéo en entier avant toute publication (aucune publication automatique)")
    report = {"file": result["path"], "status": status, "checks": checks, "human_checks": human,
              "contact_sheet": str(sheet) if sheet else "", "preview": result["preview"],
              "timeline_version": timeline["version"], "preset": result["preset"]}
    qc_dir = project.path("qc")
    atomic_write_text(qc_dir / f"{name}_qc.json", json.dumps(report, indent=2, ensure_ascii=False))
    icon = {OK: "✅", WARN: "⚠️", FAIL: "❌"}
    md = [f"# Contrôle qualité — {Path(result['path']).name}", "", f"**Statut : {status}**", "",
          "| Contrôle | Résultat | Détail |", "|---|---|---|"]
    md += [f"| {c['check']} | {icon[c['status']]} {c['status']} | {c['detail']} |" for c in checks]
    md += ["", "## À vérifier par un humain", ""] + [f"- [ ] {h}" for h in human]
    if sheet:
        md += ["", f"![Planche contact]({sheet.name})"]
    atomic_write_text(qc_dir / f"{name}_qc.md", "\n".join(md) + "\n")
    report["report_md"] = str(qc_dir / f"{name}_qc.md")
    return report
