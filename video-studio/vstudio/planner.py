"""Étapes 3 et 4 — Brief éditorial et plan de montage (timeline).

Principes appliqués (voir docs/PRINCIPES_EDITORIAUX.md) :
- la parole est l'unité insécable : on ne coupe jamais à l'intérieur d'une phrase ;
- l'ordre des propos est conservé : aucune phrase n'est déplacée d'une manière qui
  change le sens (le « teaser » éventuel est une répétition signalée, pas un déplacement) ;
- les pauses longues sont raccourcies, jamais supprimées : une respiration reste ;
- la musique ne cale que les coupes des plans sans parole ;
- chaque décision est écrite dans la timeline (champ « reason ») et dans plan.md.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from . import config
from .analysis import audio as A
from .analysis.runner import load_transcript
from .errors import ProjectError
from .project import Project, atomic_write_text


# ----------------------------------------------------------------------------- brief
def brief(project: Project, summary: dict) -> dict:
    s = project.settings
    roles = {rid: r["role"] for rid, r in summary["rushes"].items()}
    speech = sum(r["speech_time"] for r in summary["rushes"].values())
    material = sum(project.rush(rid)["info"]["duration"] for rid in roles)
    has_speech = any(r in ("parole", "mixte", "son_actif") for r in roles.values())
    main = max(project.usable_rushes(), key=lambda r: r["info"]["duration"])
    vertical_src = main["info"]["orientation"] == "vertical"
    defaults = []

    profile = s.get("profile") or ""
    if not profile:
        if has_speech and speech > 0.6 * material and len(roles) <= 2:
            profile = "reseaux_sociaux" if vertical_src else "interview"
        elif has_speech:
            profile = "reseaux_sociaux" if vertical_src else "vlog"
        else:
            profile = "cinematique" if summary.get("median_motion", 0) < 4 else "evenement"
        defaults.append(f"profil choisi automatiquement : {profile} (d'après les rushs ; modifiable avec « style »)")
    prof = config.editorial_profile(profile, s.get("overrides") or {})

    presets = s.get("presets") or [prof["default_preset"]]
    if not s.get("presets"):
        defaults.append(f"format : {presets[0]} (format par défaut du profil)")
    preset = config.export_preset(presets[0])

    target = float(s.get("target_duration") or 0)
    if not target:
        if preset["height"] > preset["width"]:
            target = 60.0
            defaults.append("durée cible : 60 s maximum (valeur par défaut pour un format vertical)")
        else:
            target = 0.0
            defaults.append("durée cible : libre (tout le contenu utile, sans les longueurs)")
    if preset.get("max_duration") and (target == 0 or target > preset["max_duration"]):
        target = float(preset["max_duration"])

    captions = s.get("captions")
    if captions is None:
        captions = bool(prof.get("captions", True)) and has_speech
    return {
        "profile": profile,
        "profile_label": prof["label"],
        "params": prof,
        "presets": presets,
        "target_duration": target,
        "captions": captions,
        "has_speech": has_speech,
        "speech_seconds": round(speech, 1),
        "material_seconds": round(material, 1),
        "questions": {
            "sujet": s.get("title") or "non précisé — déduit des rushs uniquement",
            "public": s.get("audience") or "non précisé (valeur par défaut : grand public, mobile si format vertical)",
            "émotion": prof["description"],
            "message essentiel": "porté par la parole d'origine, sans reformulation" if has_speech
                                 else "porté par les images et l'ambiance",
            "rythme": f"plans {prof['min_shot']}–{prof['max_shot']} s, pauses > {prof['pause_max']} s "
                      f"ramenées à {prof['pause_keep']} s",
            "accroche": {"aucun": "aucune (début naturel)", "teaser": "teaser : moment fort répété en ouverture",
                         "meilleur_plan": "ouverture sur le plan le plus fort"}[prof["hook"]],
            "conclusion": "dernière phrase, puis fondu de fin" if has_speech else "plan final et fondu",
        },
        "defaults_used": defaults,
    }


# ----------------------------------------------------------------------------- unités
def speech_units(project: Project, rush: dict, summary: dict, prof: dict, analysis: dict) -> list[dict]:
    rid = rush["id"]
    dur = rush["info"]["duration"]
    tr = load_transcript(project, rid)
    segs = tr.get("segments", [])
    source = "transcription"
    if not segs:
        regions = analysis.get("audio", {}).get("active_regions", [])
        segs = [{"start": a, "end": b, "text": "", "uncertain": []} for a, b in regions]
        source = "activité sonore"
    dropped = {r["drop"] for r in summary["rushes"][rid].get("retakes", [])} if prof.get("remove_retakes") else set()
    pad = prof["speech_pad"]
    raw = []
    for i, s in enumerate(segs):
        if i in dropped:
            continue
        raw.append({"start": max(0.0, s["start"] - pad), "end": min(dur, s["end"] + pad),
                    "texts": [s.get("text", "")], "uncertain": list(s.get("uncertain", [])),
                    "sentences": [i], "after_retake": (i - 1) in dropped})
    units: list[dict] = []
    for u in raw:
        if units and u["start"] - units[-1]["end"] <= prof["pause_max"]:
            last = units[-1]
            last["end"] = u["end"]
            last["texts"] += u["texts"]
            last["uncertain"] += u["uncertain"]
            last["sentences"] += u["sentences"]
            last["after_retake"] = last["after_retake"] or u["after_retake"]
        elif units:
            gap = u["start"] - units[-1]["end"]
            keep = min(prof["pause_keep"], gap) / 2
            units[-1]["end"] += keep
            u["start"] -= keep
            units.append(u)
        else:
            units.append(u)
    out = []
    for u in units:
        text = " ".join(t for t in u["texts"] if t)
        energy = _energy(analysis, u["start"], u["end"])
        out.append({"rush": rid, "in": round(u["start"], 3), "out": round(u["end"], 3), "kind": "parole",
                    "text": text, "uncertain": u["uncertain"], "energy": energy,
                    "reason": f"phrase(s) {', '.join(str(i + 1) for i in u['sentences'])} ({source})"
                    + (" — reprise gardée, prise précédente écartée" if u["after_retake"] else "")})
    return out


def _energy(analysis: dict, a: float, b: float) -> float:
    regions = analysis.get("audio", {}).get("active_regions", [])
    covered = sum(max(0, min(b, y) - max(a, x)) for x, y in regions)
    return round(covered / max(b - a, 1e-6), 3)


def broll_units(rush: dict, summary: dict, prof: dict, analysis: dict) -> list[dict]:
    rid = rush["id"]
    vis = analysis["visual"]
    step = vis.get("curve_step", 0.2) or 0.2
    curve = np.array(vis.get("motion_curve", []) or [0.0])
    out = []
    for shot in summary["rushes"][rid]["shots"]:
        if shot["tech"] < 0.4 or "image noire ou quasi noire" in shot["issues"]:
            continue
        a, b = shot["start"] + 0.2, shot["end"] - 0.2
        length = b - a
        if length < prof["min_shot"]:
            continue
        win = min(prof["max_shot"], length)
        n_windows = max(1, int(length // (prof["max_shot"] * 2)))
        starts = []
        for k in range(n_windows):
            lo = a + k * length / n_windows
            hi = min(b, lo + length / n_windows) - win
            if hi <= lo:
                starts.append(lo)
                continue
            # fenêtre où il se passe le plus de choses
            cand = np.arange(lo, hi + 1e-6, 0.2)
            best = max(cand, key=lambda t: curve[int(t / step): int((t + win) / step) + 1].mean()
                       if curve[int(t / step): int((t + win) / step) + 1].size else 0)
            starts.append(float(best))
        for st in starts:
            out.append({"rush": rid, "in": round(st, 3), "out": round(min(st + win, b), 3), "kind": "illustration",
                        "shot": shot["index"], "score": shot["score"], "subject_x": shot["subject_x"],
                        "subject_confidence": shot["subject_confidence"], "issues": shot["issues"],
                        "reason": f"plan {shot['index'] + 1} de {rid} (score {shot['score']:.2f}"
                                  + (f", {', '.join(shot['issues'])}" if shot["issues"] else "") + ")"})
    return out


# ----------------------------------------------------------------------------- assemblage
def _dur(c: dict) -> float:
    return c["out"] - c["in"]


def assemble(speech: list[dict], broll: list[dict], prof: dict, target: float, decisions: list,
             flags: list) -> list[dict]:
    clips: list[dict] = []
    used_broll: set[int] = set()

    def take_broll(max_len: float, min_len: float, avoid_rush: str | None = None) -> dict | None:
        cands = [(i, b) for i, b in enumerate(broll) if i not in used_broll and _dur(b) >= min_len]
        if not cands:
            return None
        cands.sort(key=lambda x: (x[1]["rush"] == avoid_rush, -x[1]["score"]))
        i, b = cands[0]
        used_broll.add(i)
        c = dict(b)
        c["out"] = round(c["in"] + min(_dur(c), max_len), 3)
        return c

    if not speech:
        order = sorted(range(len(broll)), key=lambda i: (-broll[i]["score"]) if prof["order"] == "score"
                       else (broll[i]["rush"], broll[i]["in"]))
        if prof["hook"] in ("meilleur_plan", "teaser") and broll:
            best = max(range(len(broll)), key=lambda i: broll[i]["score"])
            order.remove(best)
            order.insert(0, best)
            decisions.append(f"Ouverture sur le plan le plus fort ({broll[best]['reason']}).")
        total = 0.0
        last_rush = None
        pending = list(order)
        while pending and (not target or total < target - 0.5):
            # alterne les rushs pour varier les cadrages quand c'est possible
            pick = next((i for i in pending if broll[i]["rush"] != last_rush), pending[0])
            pending.remove(pick)
            c = dict(broll[pick])
            if target and total + _dur(c) > target:
                c["out"] = round(c["in"] + max(prof["min_shot"], target - total), 3)
            clips.append(c)
            total += _dur(c)
            last_rush = c["rush"]
        decisions.append(f"Montage d'images sans parole : {len(clips)} plans, alternance des rushs.")
        return clips

    # 1. parole : sélection si la durée cible l'impose
    speech_total = sum(_dur(u) for u in speech)
    chosen = list(range(len(speech)))
    if target and speech_total > target:
        ranked = sorted(chosen[1:-1], key=lambda i: (len(speech[i]["uncertain"]) / max(1, len(speech[i]["text"].split())),
                                                     -speech[i]["energy"]))
        keep = {0, len(speech) - 1}
        budget = target - _dur(speech[0]) - (_dur(speech[-1]) if len(speech) > 1 else 0)
        for i in sorted(ranked, key=lambda i: -_dur(speech[i]) * speech[i]["energy"]):
            if _dur(speech[i]) <= budget:
                keep.add(i)
                budget -= _dur(speech[i])
        removed = [i for i in chosen if i not in keep]
        chosen = sorted(keep)
        if removed:
            flags.append(f"Durée cible ({target:.0f} s) inférieure à la parole utile ({speech_total:.0f} s) : "
                         f"{len(removed)} passage(s) parlé(s) retiré(s). Vérifiez que le sens est préservé.")
            decisions.append("Passages parlés retirés pour tenir la durée : "
                             + "; ".join(f"« {speech[i]['text'][:50]}… »" for i in removed))
    spine = [dict(speech[i]) for i in chosen]

    # 2. accroche
    if prof["hook"] == "teaser" and len(spine) >= 3:
        cands = [u for u in spine[1:] if 1.2 <= _dur(u) <= 4.5 and not u["uncertain"]]
        if cands:
            t = dict(max(cands, key=lambda u: u["energy"]))
            t["kind"] = "teaser"
            t["reason"] = "accroche : moment fort répété en ouverture (repris plus loin à sa place)"
            t["flags"] = ["teaser : vérifier que cette phrase sortie de son contexte ne change pas le sens"]
            clips.append(t)
            decisions.append(f"Accroche « teaser » : « {t['text'][:60]} ».")
    elif prof["hook"] == "meilleur_plan" and broll:
        b = take_broll(min(2.5, prof["max_shot"]), prof["min_shot"])
        if b:
            b["reason"] = "ouverture sur le plan d'illustration le plus fort : " + b["reason"]
            clips.append(b)
            decisions.append("Ouverture sur le meilleur plan d'illustration.")

    # 3. colonne vertébrale + plans de coupe
    speech_kept = sum(_dur(u) for u in spine)
    cover_budget = speech_kept * prof["broll_max_cover"] if prof["broll_cutaways"] else 0.0
    for k, u in enumerate(spine):
        if cover_budget > prof["min_shot"] and _dur(u) >= 4.0 + prof["min_shot"] and broll:
            room = _dur(u) - 1.5 - 0.8
            b = take_broll(min(room, prof["max_shot"], cover_budget), prof["min_shot"])
            if b:
                start = round(u["in"] + 1.5, 3)
                u.setdefault("cutaways", []).append({
                    "rush": b["rush"], "src_in": b["in"], "src_out": b["out"], "at": start,
                    "subject_x": b["subject_x"], "subject_confidence": b["subject_confidence"],
                    "reason": "plan de coupe pendant la parole (le visage reste visible au début et à la fin) : "
                              + b["reason"]})
                cover_budget -= _dur(b)
        clips.append(u)
        # respiration entre deux idées si une vraie coupure a eu lieu et qu'il reste du budget
        nxt = spine[k + 1] if k + 1 < len(spine) else None
        if nxt and nxt["rush"] == u["rush"] and nxt["in"] - u["out"] > 2.5 and broll:
            used = sum(_dur(c) for c in clips) + sum(_dur(x) for x in spine[k + 1:])
            if not target or used + prof["min_shot"] <= target:
                b = take_broll(prof["min_shot"] + 0.6, prof["min_shot"], avoid_rush=u["rush"])
                if b:
                    b["reason"] = "respiration entre deux idées : " + b["reason"]
                    clips.append(b)

    # 4. fin intentionnelle : un plan d'illustration si le budget le permet
    used = sum(_dur(c) for c in clips)
    if broll and (not target or used + prof["min_shot"] <= target):
        b = take_broll(min(prof["max_shot"], 3.0 if not target else max(prof["min_shot"], target - used)),
                       prof["min_shot"])
        if b:
            b["reason"] = "plan de fin (conclusion visuelle, fondu de sortie) : " + b["reason"]
            b["ending"] = True
            clips.append(b)
    return enforce_target(clips, target, prof, decisions, flags)


def enforce_target(clips: list[dict], target: float, prof: dict, decisions: list, flags: list) -> list[dict]:
    """Fait respecter la durée cible sans jamais couper une phrase : on retire d'abord les
    respirations d'illustration, puis le plan de fin, puis le teaser ; en dernier recours on
    raccourcit un plan d'illustration."""
    if not target:
        return clips
    total = lambda: sum(_dur(c) for c in clips)  # noqa: E731
    tol = 0.25
    order = ([c for c in clips if c["kind"] == "illustration" and not c.get("ending")
              and c is not clips[0]]
             + [c for c in clips if c.get("ending")] + [c for c in clips if c["kind"] == "teaser"])
    removed = 0
    for c in order:
        if total() <= target + tol:
            break
        clips.remove(c)
        removed += 1
    if total() > target + tol:
        for c in reversed(clips):
            if c["kind"] == "illustration":
                c["out"] = round(max(c["in"] + prof["min_shot"], c["out"] - (total() - target)), 3)
                if total() <= target + tol:
                    break
    if removed:
        decisions.append(f"Durée cible {target:.0f} s : {removed} plan(s) sans parole retiré(s) pour la tenir.")
    if total() > target + tol:
        flags.append(f"Durée {total():.1f} s supérieure à la cible {target:.0f} s : la parole conservée "
                     "ne peut pas être raccourcie sans couper une phrase.")
    return clips


# ----------------------------------------------------------------------------- calage musical
def beat_sync(clips: list[dict], beats: list[float], tolerance: float, min_shot: float,
              rush_durations: dict, transition: float) -> int:
    """Ajuste la sortie des plans SANS parole pour que la coupe tombe sur un temps."""
    if not beats:
        return 0
    beats_arr = np.array(beats)
    t, synced = 0.0, 0
    for c in clips:
        d = _dur(c)
        end = t + d
        if c["kind"] == "illustration":
            nearest = float(beats_arr[np.argmin(np.abs(beats_arr - end))])
            delta = nearest - end
            new_d = d + delta
            max_out = rush_durations[c["rush"]] - 0.05
            if abs(delta) <= tolerance and new_d >= min_shot and c["in"] + new_d <= max_out:
                c["out"] = round(c["in"] + new_d, 3)
                c["beat"] = round(nearest, 3)
                synced += 1
                end = nearest
        t = end - (transition if c.get("transition_in") == "fondu" else 0)
    return synced


# ----------------------------------------------------------------------------- recadrage
def reframe_mode(rush: dict, out_w: int, out_h: int, prof: dict, subject_x: float, conf: float) -> tuple[str, float, list]:
    info = rush["info"]
    sw, sh = info["display_width"], info["display_height"]
    src_ar, dst_ar = sw / sh, out_w / out_h
    if abs(src_ar - dst_ar) / dst_ar < 0.08:
        return "plein", 0.5, []
    mode = prof.get("reframe", "auto")
    if mode == "auto":
        if src_ar > dst_ar and conf >= 0.55 and src_ar / dst_ar < 3.5:
            mode = "recadrage"
        else:
            mode = "flou"
    if mode == "recadrage":
        return "recadrage", subject_x, [f"recadrage automatique ({rush['id']}) centré à {subject_x * 100:.0f} % : "
                                        "vérifier qu'aucun élément essentiel n'est coupé"]
    return mode, 0.5, []


# ----------------------------------------------------------------------------- plan complet
def build_plan(project: Project, summary: dict, music: str | None = None) -> dict:
    b = brief(project, summary)
    prof = b["params"]
    preset = config.export_preset(b["presets"][0])
    analyses = {r["id"]: json.loads(project.path("analysis", f"{r['id']}.json").read_text(encoding="utf-8"))
                for r in project.usable_rushes()}
    main = max(project.usable_rushes(), key=lambda r: r["info"]["duration"])
    width = preset["width"] or main["info"]["display_width"]
    height = preset["height"] or main["info"]["display_height"]
    fps = preset["fps"] or source_fps(main["info"])
    decisions, flags = [], []

    speech, broll = [], []
    for r in project.usable_rushes():
        role = summary["rushes"][r["id"]]["role"]
        if role in ("parole", "mixte", "son_actif"):
            speech += speech_units(project, r, summary, prof, analyses[r["id"]])
        else:
            broll += broll_units(r, summary, prof, analyses[r["id"]])
        for rt in summary["rushes"][r["id"]].get("retakes", []):
            decisions.append(f"{r['id']} : prise répétée écartée « {rt['text'][:50]}… » (la dernière prise est gardée).")
    if not speech and not broll:
        raise ProjectError("Aucun passage exploitable n'a été trouvé dans les rushs.",
                           hint="Consultez analysis/rapport_analyse.md : les plans sont peut-être noirs ou figés.")
    if any(summary["rushes"][r["id"]]["role"] == "son_actif" for r in project.usable_rushes()):
        flags.append("Parole non transcrite : les coupes suivent l'activité sonore (aucune coupe au milieu d'un son), "
                     "mais pas de sous-titres automatiques. Fournissez un .srt ou installez un modèle Whisper.")

    target = b["target_duration"]
    clips = assemble(speech, broll, prof, target, decisions, flags)

    # transitions : fondu seulement entre rushs différents si le profil le demande
    for i, c in enumerate(clips):
        c["id"] = f"c{i + 1:02d}"
        c["speed"] = 1.0
        prev = clips[i - 1] if i else None
        c["transition_in"] = "fondu" if (prof["transition"] == "fondu" and prev and prev["rush"] != c["rush"]) else "cut"
        rush = project.rush(c["rush"])
        mode, cx, f = reframe_mode(rush, width, height, prof, c.get("subject_x", 0.5), c.get("subject_confidence", 0))
        c["reframe"], c["crop_x"] = mode, round(cx, 3)
        c.setdefault("flags", []).extend(f)
        for cw in c.get("cutaways", []):
            m2, cx2, f2 = reframe_mode(project.rush(cw["rush"]), width, height, prof, cw["subject_x"],
                                       cw["subject_confidence"])
            cw["reframe"], cw["crop_x"] = m2, round(cx2, 3)
            c["flags"].extend(f2)
        loud = summary["rushes"][c["rush"]].get("loudness", {}).get("integrated_lufs")
        if c["kind"] in ("parole", "teaser"):
            c["audio"] = "source"
            c["gain_db"] = round(float(np.clip(-20 - loud, -12, 18)), 1) if loud is not None else 0.0
        else:
            c["audio"] = "ambiance" if rush["info"]["has_audio"] else "muet"
            c["gain_db"] = round(float(np.clip(-30 - loud, -20, 6)), 1) if loud is not None else 0.0

    music_info = None
    music = music or project.settings.get("music") or ""
    if music:
        if not Path(music).exists():
            raise ProjectError(f"Musique introuvable : {music}")
        beats = A.detect_beats(music)
        music_info = {"path": str(Path(music).resolve()), "bpm": beats["bpm"],
                      "beat_confidence": beats["confidence"], "level_db": prof["music_db"],
                      "duck_db": prof["duck_db"], "provenance": project.settings.get("music_provenance")
                      or "fournie par l'utilisateur (droits à vérifier par l'utilisateur)"}
        if prof["beat_sync"] and beats["confidence"] > 0.2:
            n = beat_sync(clips, beats["beats"], prof["beat_tolerance"], prof["min_shot"],
                          {r["id"]: r["info"]["duration"] for r in project.usable_rushes()},
                          prof["transition_duration"])
            music_info["synced_cuts"] = n
            decisions.append(f"Musique {beats['bpm']:.0f} BPM : {n} coupe(s) de plans sans parole calée(s) sur les temps "
                             "(la parole n'est jamais recoupée pour la musique).")
        elif prof["beat_sync"]:
            decisions.append("Tempo de la musique peu fiable : aucune coupe calée sur la musique.")
        if target:
            clips = enforce_target(clips, target, prof, decisions, flags)
    else:
        decisions.append("Pas de musique (aucune fournie). Ajoutez-en une avec --music si vous en avez les droits.")

    speakers = project.settings.get("speakers") or {}
    total = sum(_dur(c) for c in clips) - sum(prof["transition_duration"] for c in clips if c["transition_in"] == "fondu")
    timeline = {
        "project": project.state["slug"],
        "brief": b,
        "profile": b["profile"],
        "params": prof,
        "preset": b["presets"][0],
        "presets": b["presets"],
        "width": width, "height": height, "fps": fps,
        "color": prof["color"],
        "captions": b["captions"],
        "subtitle_style": prof.get("subtitle_style") or preset["subtitle_style"],
        "subtitle_scale": float(project.settings.get("subtitle_scale") or 1.0),
        "titles": {"title": project.settings.get("title", ""), "end_text": project.settings.get("end_text", ""),
                   "speakers": speakers},
        "music": music_info,
        "fade_in": prof["fade_in"], "fade_out": prof["fade_out"],
        "transition_duration": prof["transition_duration"],
        "clips": clips,
        "expected_duration": round(total, 3),
        "decisions": decisions,
        "flags": flags + [f for c in clips for f in c.get("flags", [])],
    }
    return timeline


def source_fps(info: dict) -> float:
    """Cadence de sortie quand on « garde la cadence source » : la cadence nominale si elle est
    standard (cas des fichiers à cadence variable, dont la moyenne est trompeuse), sinon la moyenne."""
    nominal, avg = info.get("fps") or 0, info.get("avg_fps") or 0
    standard = (23.976, 24, 25, 29.97, 30, 50, 59.94, 60)
    if nominal and any(abs(nominal - s) < 0.05 for s in standard):
        return _standard_fps(nominal)
    return _standard_fps(avg or nominal)


def _standard_fps(f: float) -> float:
    for s in (23.976, 24, 25, 29.97, 30, 50, 59.94, 60):
        if abs(f - s) < 0.6:
            return 30.0 if s == 29.97 else (60.0 if s == 59.94 else (24.0 if s == 23.976 else float(s)))
    return 30.0 if f > 60 or f < 15 else round(f)


def fmt_tc(t: float) -> str:
    return f"{int(t // 60):02d}:{t % 60:05.2f}"


def write_plan_md(project: Project, timeline: dict) -> Path:
    b = timeline["brief"]
    L = [f"# Plan de montage v{timeline['version']:03d} — {project.state['name']}", "",
         f"**Profil** : {b['profile_label']} · **Format** : {timeline['preset']} ({timeline['width']}×{timeline['height']}, "
         f"{timeline['fps']} i/s) · **Durée prévue** : {timeline['expected_duration']:.1f} s"
         + (f" (cible {b['target_duration']:.0f} s)" if b["target_duration"] else ""), "",
         "## Brief éditorial", ""]
    L += [f"- **{k}** : {v}" for k, v in b["questions"].items()]
    if b["defaults_used"]:
        L += ["", "Valeurs par défaut appliquées (information manquante) :"] + [f"- {d}" for d in b["defaults_used"]]
    L += ["", "## Timeline", "", "| # | Début | Durée | Source | Type | Contenu / raison |", "|---|---|---|---|---|---|"]
    t = 0.0
    for c in timeline["clips"]:
        d = c["out"] - c["in"]
        if c["transition_in"] == "fondu":
            t -= timeline["transition_duration"]
        what = (f"« {c['text'][:70]} » — " if c.get("text") else "") + c["reason"]
        for cw in c.get("cutaways", []):
            what += f" ⟶ plan de coupe {cw['rush']} {cw['src_in']:.1f}–{cw['src_out']:.1f} s"
        L.append(f"| {c['id']} | {fmt_tc(t)} | {d:.1f} s | {c['rush']} {c['in']:.2f}–{c['out']:.2f} | "
                 f"{c['kind']}{' (fondu)' if c['transition_in'] == 'fondu' else ''} | {what} |")
        t += d
    L += ["", "## Décisions", ""] + [f"- {d}" for d in timeline["decisions"]]
    if timeline["flags"]:
        L += ["", "## À vérifier par un humain", ""] + [f"- [ ] {f}" for f in timeline["flags"]]
    p = project.path("timeline", f"plan_v{timeline['version']:03d}.md")
    atomic_write_text(p, "\n".join(L) + "\n")
    return p
