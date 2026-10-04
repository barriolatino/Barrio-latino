"""Étapes 5 à 8 — Assemblage, habillage, finition et rendu.

Chaîne :
  1. chaque plan de la timeline est rendu en segment intermédiaire (cache/seg_<clé>.mkv),
     avec cadence constante, recadrage, correction couleur et traitement de la voix.
     La clé dépend de tous les paramètres : un segment déjà rendu est réutilisé
     (reprise après interruption, révisions locales sans tout recalculer) ;
  2. assemblage des segments (copie directe, ou fondus enchaînés si demandés) ;
  3. mixage : voix + musique (ducking sous la voix), normalisation EBU R128 en deux passes,
     export d'un audio de contrôle (WAV) ;
  4. passe finale : fondus d'entrée/sortie, sous-titres et titres incrustés, encodage H.264/AAC.
Chaque fichier est écrit sous un nom temporaire puis renommé : une interruption ne
laisse jamais un fichier final incomplet.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from . import config, ffmpeg
from . import subtitles as S
from .analysis.runner import load_transcript
from .errors import FFmpegError
from .project import Project, stable_hash

RENDER_VERSION = 4
FONTS_DIR = config.STUDIO_ROOT / "assets" / "fonts"


# ----------------------------------------------------------------------------- filtres image
def color_chain(profile: dict, rush_summary: dict | None) -> str:
    parts = []
    gamma = profile.get("gamma", 1.0)
    brightness = profile.get("brightness", 0.0)
    if rush_summary and profile["name"] != "aucun":
        lum = rush_summary.get("mean_luma") or 110
        if lum < 75:  # correction d'exposition modérée
            gamma *= min(1.25, 1 + (75 - lum) / 180)
        elif lum > 175:
            gamma *= max(0.88, 1 - (lum - 175) / 300)
        cast = rush_summary.get("color_cast") or {}
        if cast and profile.get("saturation", 1) > 0:
            dev = {k: cast[k] - 1 for k in "rgb"}
            big = max(abs(v) for v in dev.values())
            # dominante modérée → harmonisation ; dominante forte → probablement voulue (coucher de soleil…)
            if 0.04 < big < 0.22:
                rm, gm, bm = (round(max(-0.12, min(0.12, -dev[k] * 0.45)), 3) for k in "rgb")
                parts.append(f"colorbalance=rm={rm}:gm={gm}:bm={bm}")
    parts.append(f"eq=contrast={profile['contrast']}:brightness={brightness}:saturation={profile['saturation']}"
                 f":gamma={round(gamma, 3)}")
    if profile.get("temperature_mix", 0) > 0:
        parts.append(f"colortemperature=temperature={profile['temperature']}:mix={profile['temperature_mix']}")
    cb = {k: profile.get(k, 0) for k in ("shadows_r", "shadows_b", "highlights_r", "highlights_b")}
    if any(cb.values()):
        parts.append(f"colorbalance=rs={cb['shadows_r']}:bs={cb['shadows_b']}:rh={cb['highlights_r']}:bh={cb['highlights_b']}")
    return ",".join(parts)


def reframe_chain(mode: str, crop_x: float, W: int, H: int, src_w: int, src_h: int, label: str) -> str:
    """Graphe qui transforme [in_label] en [label] au format W×H, sans déformer l'image."""
    if mode == "recadrage" and src_w * H / src_h >= W:
        sw = round(src_w * H / src_h / 2) * 2
        x = max(0, min(sw - W, round(crop_x * sw - W / 2)))
        return f"scale={sw}:{H}:flags=lanczos,crop={W}:{H}:{x}:0[{label}]"
    if mode == "plein":
        return f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H}[{label}]"
    if mode == "cadre":
        return (f"scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black[{label}]")
    # flou : arrière-plan flouté issu de la même image, image complète au centre
    return (f"split[{label}bg][{label}fg];"
            f"[{label}bg]scale={W // 4}:{H // 4}:force_original_aspect_ratio=increase,crop={W // 4}:{H // 4},"
            f"boxblur=10:2,eq=brightness=-0.06:saturation=0.85,scale={W}:{H}[{label}b];"
            f"[{label}fg]scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos[{label}f];"
            f"[{label}b][{label}f]overlay=(W-w)/2:(H-h)/2[{label}]")


def voice_chain(prof: dict, noise_floor: float | None) -> str:
    parts = ["highpass=f=75"]
    if prof["denoise"] > 0 and noise_floor is not None and noise_floor > -70:
        nr = round(3 + prof["denoise"] * 12, 1)  # 3–15 dB : jamais agressif
        nf = max(-80, min(-25, round(noise_floor)))
        parts.append(f"afftdn=nr={nr}:nf={nf}:tn=1")
    if prof["compress"]:
        parts.append("acompressor=threshold=-22dB:ratio=2.2:attack=12:release=220:makeup=1.5")
    return ",".join(parts)


# ----------------------------------------------------------------------------- segments
def segment_key(project: Project, timeline: dict, clip: dict) -> str:
    rushes = [clip["rush"]] + [c["rush"] for c in clip.get("cutaways", [])]
    fps_keys = [project.rush(r)["fingerprint"] for r in rushes]
    keep = {k: clip.get(k) for k in ("rush", "in", "out", "speed", "reframe", "crop_x", "audio", "gain_db",
                                     "cutaways", "kind")}
    return stable_hash([RENDER_VERSION, fps_keys, keep, timeline["width"], timeline["height"], timeline["fps"],
                        timeline["color"], {k: timeline["params"][k] for k in ("denoise", "compress")}])


def render_segment(project: Project, timeline: dict, clip: dict, summary: dict, out: Path) -> Path:
    W, H, fps = timeline["width"], timeline["height"], timeline["fps"]
    rush = project.rush(clip["rush"])
    info = rush["info"]
    speed = clip.get("speed", 1.0)
    src_d = clip["out"] - clip["in"]
    d = src_d / speed
    rs = summary["rushes"].get(clip["rush"], {})
    col = color_chain(config.color_profile(timeline["color"]), rs)
    args = ["-ss", f"{clip['in']:.3f}", "-t", f"{src_d:.3f}", "-i", rush["path"]]
    graph = [f"[0:v]fps={fps},setpts=(PTS-STARTPTS)/{speed},setsar=1,"
             + reframe_chain(clip["reframe"], clip["crop_x"], W, H, info["display_width"], info["display_height"], "m0")]
    graph.append(f"[m0]{col},format=yuv420p[main]")
    vlabel = "main"
    cutaways = clip.get("cutaways", [])
    if cutaways:
        cw = cutaways[0]
        crush = project.rush(cw["rush"])
        cd = cw["src_out"] - cw["src_in"]
        a = (cw["at"] - clip["in"]) / speed
        args += ["-ss", f"{cw['src_in']:.3f}", "-t", f"{cd:.3f}", "-i", crush["path"]]
        ccol = color_chain(config.color_profile(timeline["color"]), summary["rushes"].get(cw["rush"], {}))
        graph.append(f"[1:v]fps={fps},setpts=PTS-STARTPTS,setsar=1,"
                     + reframe_chain(cw["reframe"], cw["crop_x"], W, H, crush["info"]["display_width"],
                                     crush["info"]["display_height"], "c0"))
        graph.append(f"[c0]{ccol},format=yuv420p,trim=duration={cd:.3f},setpts=PTS-STARTPTS[cut]")
        graph.append(f"[main]split[ma][mb];[ma]trim=0:{a:.3f},setpts=PTS-STARTPTS[p1];"
                     f"[mb]trim={a + cd:.3f}:{d:.3f},setpts=PTS-STARTPTS[p3];"
                     f"[p1][cut][p3]concat=n=3:v=1:a=0[vc]")
        vlabel = "vc"
    graph.append(f"[{vlabel}]trim=duration={d:.3f},setpts=PTS-STARTPTS[v]")

    fade = min(0.012, d / 4)
    if clip["audio"] in ("source", "ambiance") and info["has_audio"]:
        chain = f"[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS"
        if speed != 1.0:
            chain += f",atempo={max(0.5, min(2.0, speed))}"
        if clip["audio"] == "source":
            ana = json.loads(project.path("analysis", f"{clip['rush']}.json").read_text(encoding="utf-8"))
            chain += "," + voice_chain(timeline["params"], ana.get("audio", {}).get("noise_floor_db"))
        chain += f",volume={clip.get('gain_db', 0)}dB,apad,atrim=0:{d:.3f}"
        chain += f",afade=t=in:d={fade:.3f},afade=t=out:st={d - fade:.3f}:d={fade:.3f}[a]"
        graph.append(chain)
    else:
        graph.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{d:.3f}[a]")
    tmp = out.with_name(out.stem + ".part.mkv")
    ffmpeg.run([*args, "-filter_complex", ";".join(graph), "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-g", str(int(fps)),
                "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", "-ar", "48000", "-t", f"{d:.3f}", str(tmp)],
               log=project.log)
    os.replace(tmp, out)
    return out


def render_segments(project: Project, timeline: dict, summary: dict, progress=None) -> list[Path]:
    seg_dir = project.path("cache")
    paths = []
    n = len(timeline["clips"])
    reused = 0
    for i, clip in enumerate(timeline["clips"]):
        key = segment_key(project, timeline, clip)
        p = seg_dir / f"seg_{key}.mkv"
        if p.exists() and _valid(p):
            reused += 1
        else:
            if progress:
                progress(f"segment {i + 1}/{n} ({clip['id']}, {clip['kind']})")
            render_segment(project, timeline, clip, summary, p)
        paths.append(p)
    if reused:
        project.journal(f"    {reused}/{n} segment(s) réutilisé(s) depuis le cache (reprise)")
    return paths


def _valid(p: Path) -> bool:
    try:
        return ffmpeg.probe(p).duration > 0
    except Exception:
        return False


# ----------------------------------------------------------------------------- assemblage
def assemble(project: Project, timeline: dict, segs: list[Path], out: Path) -> float:
    durs = [ffmpeg.probe(p).duration for p in segs]
    fondus = [c["transition_in"] == "fondu" for c in timeline["clips"]]
    tmp = out.with_name(out.stem + ".part.mkv")
    if not any(fondus[1:]):
        lst = out.with_suffix(".txt")
        lst.write_text("".join(f"file '{p.resolve()}'\n" for p in segs), encoding="utf-8")
        ffmpeg.run(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(tmp)], log=project.log)
    else:
        td = timeline["transition_duration"]
        args, graph = [], []
        for p in segs:
            args += ["-i", str(p)]
        vlast, alast, t = "0:v", "0:a", durs[0]
        for i in range(1, len(segs)):
            if fondus[i]:
                dd = min(td, durs[i] / 3, durs[i - 1] / 3)
                graph.append(f"[{vlast}][{i}:v]xfade=transition=fade:duration={dd:.3f}:offset={t - dd:.3f}[v{i}]")
                graph.append(f"[{alast}][{i}:a]acrossfade=d={dd:.3f}:c1=tri:c2=tri[a{i}]")
                t += durs[i] - dd
            else:
                graph.append(f"[{vlast}][{alast}][{i}:v][{i}:a]concat=n=2:v=1:a=1[v{i}][a{i}]")
                t += durs[i]
            vlast, alast = f"v{i}", f"a{i}"
        ffmpeg.run([*args, "-filter_complex", ";".join(graph), "-map", f"[{vlast}]", "-map", f"[{alast}]",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-pix_fmt", "yuv420p",
                    "-c:a", "pcm_s16le", str(tmp)], log=project.log)
    os.replace(tmp, out)
    return ffmpeg.probe(out).duration


# ----------------------------------------------------------------------------- audio
def speech_intervals(timeline: dict) -> list[tuple[float, float]]:
    out, t = [], 0.0
    for c in timeline["clips"]:
        if c["transition_in"] == "fondu":
            t -= timeline["transition_duration"]
        d = (c["out"] - c["in"]) / c.get("speed", 1.0)
        if c["kind"] in ("parole", "teaser"):
            if out and t - out[-1][1] < 0.8:
                out[-1] = (out[-1][0], t + d)
            else:
                out.append((t, t + d))
        t += d
    return out


def duck_expression(level_db: float, duck_db: float, intervals: list, ramp: float = 0.35) -> str:
    if not intervals:
        return f"{10 ** (level_db / 20):.5f}"
    terms = []
    for a, b in intervals:
        terms.append(f"clip((t-{a - ramp:.3f})/{ramp},0,1)*clip(({b + ramp:.3f}-t)/{ramp},0,1)")
    f = terms[0]
    for t in terms[1:]:
        f = f"max({f},{t})"
    return f"pow(10,({level_db}+({duck_db})*{f})/20)"


def mix_audio(project: Project, timeline: dict, assembly: Path, total: float, preset: dict, out_wav: Path) -> dict:
    """Mixe voix + musique, normalise (2 passes) et écrit l'audio de contrôle."""
    fade_in, fade_out = max(0.05, timeline["fade_in"]), max(0.1, timeline["fade_out"])
    args = ["-i", str(assembly)]
    graph = ["[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo[voice]"]
    music = timeline.get("music")
    if music:
        mi = ffmpeg.probe(music["path"])
        from .analysis.audio import loudness
        mlufs = (loudness(music["path"]) or {}).get("integrated_lufs") or -18.0
        base = -20.0 + music["level_db"] - mlufs  # niveau relatif à une voix ≈ -20 LUFS
        args += ["-stream_loop", "-1", "-i", music["path"]]
        expr = duck_expression(base, music["duck_db"], speech_intervals(timeline))
        graph.append(f"[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:{total:.3f},"
                     f"asetpts=PTS-STARTPTS,volume='{expr}':eval=frame,"
                     f"afade=t=in:d=1.0,afade=t=out:st={max(0, total - max(fade_out, 1.5)):.3f}:d={max(fade_out, 1.5):.3f}[mus]")
        graph.append("[voice][mus]amix=inputs=2:duration=first:normalize=0[mix]")
        project.journal(f"    musique : {Path(music['path']).name} ({mi.duration:.0f} s, {mlufs:.1f} LUFS), "
                        f"ducking {music['duck_db']} dB sous la voix")
    else:
        graph.append("[voice]anull[mix]")
    graph.append(f"[mix]afade=t=in:d={fade_in:.3f},afade=t=out:st={max(0, total - fade_out):.3f}:d={fade_out:.3f},"
                 f"atrim=0:{total:.3f}[out]")
    premix = out_wav.with_name(out_wav.stem + "_premix.wav")
    ffmpeg.run([*args, "-filter_complex", ";".join(graph), "-map", "[out]", "-c:a", "pcm_f32le", "-ar", "48000",
                "-t", f"{total:.3f}", str(premix)], log=project.log)
    # passe 1 : mesure
    target = preset["loudness"] + timeline.get("loudness_offset", 0.0)
    tp = preset["true_peak"] + timeline.get("true_peak_offset", 0.0)
    err = ffmpeg.run_filter_log(["-i", str(premix), "-af", f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json",
                                 "-f", "null", "-"], log=project.log)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S)
    meas = json.loads(m.group(0)) if m else {}
    if meas and meas.get("input_i") not in ("-inf", None) and float(meas["input_i"]) > -70:
        ln = (f"loudnorm=I={target}:TP={tp}:LRA=11:measured_I={meas['input_i']}:measured_TP={meas['input_tp']}:"
              f"measured_LRA={meas['input_lra']}:measured_thresh={meas['input_thresh']}:offset={meas['target_offset']}:"
              f"linear=true:print_format=summary")
        af = f"{ln},alimiter=limit={10 ** ((tp - 0.3) / 20):.4f}:attack=5:release=50:level=false,aresample=48000"
    else:
        af = "anull"  # piste silencieuse : rien à normaliser
    tmp = out_wav.with_name(out_wav.stem + ".part.wav")
    ffmpeg.run(["-i", str(premix), "-af", af, "-c:a", "pcm_s16le", "-ar", "48000", "-t", f"{total:.3f}", str(tmp)],
               log=project.log)
    os.replace(tmp, out_wav)
    premix.unlink(missing_ok=True)
    return {"measured_before": meas.get("input_i"), "target": target}


# ----------------------------------------------------------------------------- passe finale
def final_encode(project: Project, timeline: dict, assembly: Path, master: Path, ass: Path | None, preset: dict,
                 total: float, out: Path, preview: bool = False) -> Path:
    fade_in, fade_out = timeline["fade_in"], timeline["fade_out"]
    vf = []
    if fade_in > 0:
        vf.append(f"fade=t=in:st=0:d={fade_in:.3f}")
    if fade_out > 0:
        vf.append(f"fade=t=out:st={max(0, total - fade_out):.3f}:d={fade_out:.3f}")
    if ass:
        fd = f":fontsdir={ffmpeg.ffmpeg_escape_path(FONTS_DIR)}" if any(FONTS_DIR.glob("*.[ot]tf")) else ""
        vf.append(f"ass={ffmpeg.ffmpeg_escape_path(ass)}{fd}")
    W, H = timeline["width"], timeline["height"]
    if preview:
        pw = (W // 2) // 2 * 2
        ph = (H // 2) // 2 * 2
        vf.append(f"scale={pw}:{ph}:flags=bicubic")
    vf.append("format=yuv420p")
    venc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]
    if preview:
        venc += ["-preset", "veryfast", "-crf", "26"]
    else:
        venc += ["-preset", preset["x264_preset"], "-crf", str(preset["crf"])]
        if preset.get("maxrate"):
            rate = int(preset["maxrate"].rstrip("M"))
            venc += ["-maxrate", preset["maxrate"], "-bufsize", f"{rate * 2}M"]
    tmp = out.with_name(out.stem + ".part.mp4")
    ffmpeg.run(["-i", str(assembly), "-i", str(master), "-map", "0:v", "-map", "1:a", "-vf", ",".join(vf), *venc,
                "-r", str(timeline["fps"]), "-g", str(int(timeline["fps"] * 2)),
                "-c:a", "aac", "-b:a", "128k" if preview else preset["audio_bitrate"], "-ar", "48000",
                "-t", f"{total:.3f}", "-movflags", "+faststart",
                "-metadata", f"comment=Claude Video Studio Pro — projet {project.state['slug']} — "
                             f"timeline v{timeline['version']:03d}{' — PRÉVISUALISATION' if preview else ''}",
                str(tmp)], log=project.log, timeout=None)
    os.replace(tmp, out)
    return out


# ----------------------------------------------------------------------------- orchestration
def render(project: Project, timeline: dict, preset_name: str, preview: bool, progress=None) -> dict:
    preset = config.export_preset(preset_name)
    summary = json.loads(project.path("analysis", "synthese.json").read_text(encoding="utf-8"))
    v = timeline["version"]
    tag = f"v{v:03d}_{preset_name}_{timeline['width']}x{timeline['height']}"
    work = project.path("cache", f"build_{tag}")
    work.mkdir(parents=True, exist_ok=True)
    log = project.journal
    log(f"Rendu {'prévisualisation' if preview else 'final'} — timeline v{v:03d}, format {preset_name}")
    segs = render_segments(project, timeline, summary, progress=lambda m: log("    " + m))
    assembly = work / "assemblage.mkv"
    if not (assembly.exists() and (work / "assemblage.key").exists()
            and (work / "assemblage.key").read_text() == stable_hash([str(s) for s in segs])):
        log("    assemblage des plans")
        assemble(project, timeline, segs, assembly)
        (work / "assemblage.key").write_text(stable_hash([str(s) for s in segs]))
    total = ffmpeg.probe(assembly).duration
    master = work / "audio_controle.wav"
    log("    mixage, ducking et normalisation du son")
    loud = mix_audio(project, timeline, assembly, total, preset, master)

    ass = None
    sub_info = {"cues": 0, "to_review": 0}
    if timeline.get("captions") or any(timeline.get("titles", {}).get(k) for k in ("title", "end_text")) \
            or timeline.get("titles", {}).get("speakers") or preview:
        transcripts = {r["id"]: load_transcript(project, r["id"]) for r in project.usable_rushes()}
        timeline["lang"] = _timeline_lang(project, transcripts)
        style = S.style_for(timeline)
        cues = S.make_cues(timeline, transcripts, style) if timeline.get("captions") else []
        sub_dir = project.path("subtitles")
        base = f"{project.state['slug']}_{tag}"
        if cues:
            S.write_srt(cues, sub_dir / f"{base}.srt")
            S.write_vtt(cues, sub_dir / f"{base}.vtt")
            sub_info["to_review"] = S.write_review_list(cues, sub_dir / "a_verifier.txt")
        ass = sub_dir / f"{base}{'_preview' if preview else ''}.ass"
        S.write_ass(cues, ass, timeline, preset, style,
                    watermark=f"PRÉVISUALISATION v{v:03d}" if preview else "")
        S.write_ass(cues, sub_dir / f"{base}_seuls.ass", timeline, preset, style, only_subtitles=True)
        sub_info.update(cues=len(cues), srt=str(sub_dir / f"{base}.srt") if cues else "",
                        ass_only=str(sub_dir / f"{base}_seuls.ass"))
        if cues:
            log(f"    {len(cues)} sous-titre(s) — style {style['name']}"
                + (f", {sub_info['to_review']} à vérifier (subtitles/a_verifier.txt)" if sub_info["to_review"] else ""))
    folder = project.path("previews" if preview else "exports")
    name = f"{project.state['slug']}_{tag}{'_preview' if preview else ''}.mp4"
    out = folder / name
    log("    encodage " + ("de la prévisualisation" if preview else f"final ({preset['label']})"))
    final_encode(project, timeline, assembly, master, ass, preset, total, out, preview=preview)
    if not preview:
        ctrl = folder / f"{project.state['slug']}_{tag}_audio_controle.wav"
        import shutil
        shutil.copy2(master, ctrl)
        if sub_info.get("srt"):
            shutil.copy2(sub_info["srt"], folder / Path(sub_info["srt"]).name)
            shutil.copy2(Path(sub_info["srt"]).with_suffix(".vtt"), folder / Path(sub_info["srt"]).with_suffix(".vtt").name)
    result = {"path": str(out), "preview": preview, "preset": preset_name, "timeline_version": v,
              "duration": total, "subtitles": sub_info, "loudness": loud, "work": str(work)}
    project.state["renders"].append({**result, "at": __import__("datetime").datetime.now().isoformat(timespec="seconds")})
    project.save()
    log(f"    → {out.relative_to(project.root)}")
    return result


def _timeline_lang(project: Project, transcripts: dict) -> str:
    lang = project.settings.get("lang") or "auto"
    if lang != "auto":
        return lang
    langs = {tr.get("lang") for tr in transcripts.values() if tr.get("lang")}
    return langs.pop() if len(langs) == 1 else ""
