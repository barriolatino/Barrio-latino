"""Génération de médias de test entièrement synthétiques (aucun droit tiers).

Images : sources FFmpeg (gradients, mandelbrot, cellauto, testsrc2).
Voix   : synthèse vocale Flite intégrée à FFmpeg (voix anglaises uniquement).
Musique: synthèse par formule (aevalsrc), tempo connu.
Chaque fichier généré est accompagné d'un fichier PROVENANCE.txt.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from . import ffmpeg


def _ff(*args: str) -> None:
    proc = subprocess.run([ffmpeg.FFMPEG, "-hide_banner", "-nostdin", "-loglevel", "error", "-y", *args],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-1500:])


def speech_track(out: Path, script: list, room_tone_db: float = -52.0) -> list[tuple[float, float, str]]:
    """Construit une piste voix à partir d'éléments (texte, voix) ou ("pause", secondes).

    Renvoie les intervalles de parole (début, fin, texte) pour vérifier l'analyse.
    """
    tmp = out.parent / (out.stem + "_parts")
    tmp.mkdir(exist_ok=True)
    parts, spans, t = [], [], 0.0
    for k, item in enumerate(script):
        p = tmp / f"{k:02d}.wav"
        if item[0] == "pause":
            _ff("-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", f"{item[1]:.3f}", str(p))
            dur = item[1]
        else:
            text, voice = item
            safe = text.replace("'", "").replace(":", " ").replace(",", " ")
            _ff("-f", "lavfi", "-i", f"flite=text='{safe}':voice={voice}", "-ar", "48000", "-ac", "1", str(p))
            dur = ffmpeg.probe(p).duration
            spans.append((round(t, 3), round(t + dur, 3), text))
        parts.append(p)
        t += dur
    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
    raw = tmp / "voice.wav"
    _ff("-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(raw))
    amp = 10 ** (room_tone_db / 20)
    _ff("-i", str(raw), "-f", "lavfi", "-i", f"anoisesrc=c=pink:r=48000:a={amp:.5f}",
        "-filter_complex", "[0]aresample=48000[v];[v][1]amix=inputs=2:duration=first:normalize=0",
        "-ac", "1", str(out))
    shutil.rmtree(tmp, ignore_errors=True)
    return spans


def video_source(kind: str, w: int, h: int, d: float, fps: int = 30) -> str:
    return {
        "gradient": f"gradients=s={w}x{h}:d={d}:r={fps}:speed=0.012:c0=0x3a2a1e:c1=0xc98a52:c2=0x6b3b23:nb_colors=3",
        "gradient_froid": f"gradients=s={w}x{h}:d={d}:r={fps}:speed=0.02:c0=0x1e2f3a:c1=0x5aa0c9:c2=0x23506b:nb_colors=3",
        "mandelbrot": f"mandelbrot=s={w}x{h}:r={fps}:end_scale=0.5,trim=duration={d}",
        "life": f"cellauto=s={w}x{h}:r={fps}:rule=110:random_fill_ratio=0.5,trim=duration={d},"
                f"colorchannelmixer=rr=0.9:gg=0.6:bb=0.3",
        "testsrc": f"testsrc2=s={w}x{h}:d={d}:r={fps}",
        "sombre": f"gradients=s={w}x{h}:d={d}:r={fps}:speed=0.01:c0=0x050505:c1=0x151515,format=yuv420p",
    }[kind]


def make_clip(out: Path, w: int, h: int, scenes: list[tuple[str, float]], audio: Path | None = None,
              ambience_db: float | None = -38.0, fps: int = 30, crf: int = 23) -> Path:
    inputs, chains = [], []
    for i, (kind, d) in enumerate(scenes):
        inputs += ["-f", "lavfi", "-i", video_source(kind, w, h, d, fps)]
        chains.append(f"[{i}:v]setsar=1,format=yuv420p[v{i}]")
    n = len(scenes)
    graph = ";".join(chains) + ";" + "".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[v]"
    total = sum(d for _, d in scenes)
    args = [*inputs]
    maps = ["-map", "[v]"]
    if audio is not None:
        args += ["-i", str(audio)]
        graph += f";[{n}:a]apad,atrim=0:{total}[a]"
        maps += ["-map", "[a]"]
    elif ambience_db is not None:
        amp = 10 ** (ambience_db / 20)
        args += ["-f", "lavfi", "-i", f"anoisesrc=c=brown:r=48000:a={amp:.4f}:d={total}"]
        maps += ["-map", f"{n}:a"]
    _ff(*args, "-filter_complex", graph, *maps, "-t", f"{total}", "-c:v", "libx264", "-preset", "veryfast",
        "-crf", str(crf), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ac", "2",
        "-movflags", "+faststart", str(out))
    return out


def make_music(out: Path, seconds: float = 60, bpm: float = 100) -> Path:
    p = 60 / bpm
    expr = (f"0.55*sin(2*PI*55*t)*exp(-14*mod(t\\,{p}))"
            f"+0.18*sin(2*PI*1200*t)*exp(-60*mod(t+{p / 2}\\,{p}))*0.6"
            f"+0.06*(sin(2*PI*220*t)+sin(2*PI*277.2*t)+sin(2*PI*329.6*t))*(0.7+0.3*sin(2*PI*t/({p}*8)))")
    _ff("-f", "lavfi", "-i", f"aevalsrc={expr}:s=48000:d={seconds}", "-af", "volume=0.8",
        "-ac", "2", "-c:a", "pcm_s16le", str(out))
    return out


PROVENANCE = """Médias de démonstration générés localement par Claude Video Studio Pro (vstudio/demo.py).
- Images : sources de synthèse FFmpeg (gradients, mandelbrot, cellauto, testsrc2).
- Voix : synthèse vocale Flite (FFmpeg libflite, licence BSD-like), textes écrits pour la démo.
- Musique : synthétisée par formule mathématique (aevalsrc), {bpm} BPM.
Aucun contenu tiers. Libres d'usage pour les tests.
"""

COOKING_SCRIPT = [
    ("pause", 0.6),
    ("Welcome to the kitchen.", "slt"),
    ("pause", 0.5),
    ("Today we cook a simple rice dish.", "slt"),
    ("pause", 2.4),  # longueur à raccourcir
    ("First we wash the rice in cold water.", "slt"),
    ("pause", 0.8),
    ("Then we cut the fresh vegetables.", "slt"),  # prise ratée...
    ("pause", 1.0),
    ("Then we cut the fresh vegetables into small pieces.", "slt"),  # ...reprise
    ("pause", 0.6),
    ("Everything goes into the pan for twenty minutes.", "slt"),
    ("pause", 3.0),
    ("And it is ready. Enjoy your meal.", "slt"),
    ("pause", 0.8),
]


def make_demo_set(dest: Path) -> dict:
    """Jeu de rushs de démonstration : face caméra vertical + illustrations + musique."""
    dest.mkdir(parents=True, exist_ok=True)
    voice = dest / "_voix.wav"
    spans = speech_track(voice, COOKING_SCRIPT)
    dur = ffmpeg.probe(voice).duration
    make_clip(dest / "01_face_camera_vertical.mp4", 720, 1280, [("gradient", round(dur, 2))], audio=voice)
    voice.unlink()
    make_clip(dest / "02_gestes_horizontal.mp4", 1280, 720,
              [("life", 4.0), ("mandelbrot", 5.0), ("gradient_froid", 4.0)], ambience_db=-40)
    make_clip(dest / "03_details_horizontal.mp4", 1280, 720, [("mandelbrot", 6.0), ("life", 3.0)], ambience_db=-42)
    music_dir = dest / "musique"
    music_dir.mkdir(exist_ok=True)
    make_music(music_dir / "demo_100bpm.wav", 90, 100)
    (dest / "PROVENANCE.txt").write_text(PROVENANCE.format(bpm=100), encoding="utf-8")
    return {"speech_spans": spans, "music": str(music_dir / "demo_100bpm.wav")}


# ----------------------------------------------------------------------------- cas de test particuliers
def make_rotated(out: Path, rotation: int = 90) -> Path:
    """Vidéo codée en 1280×720 avec une matrice d'affichage (rotation), repère blanc en haut à gauche."""
    src = out.with_name(out.stem + "_src.mp4")
    _ff("-f", "lavfi", "-i", "gradients=s=640x360:d=4:r=30:speed=0.01", "-vf",
        "drawbox=x=0:y=0:w=160:h=90:color=white:t=fill", "-c:v", "libx264", "-preset", "veryfast",
        "-pix_fmt", "yuv420p", str(src))
    _ff("-display_rotation", str(rotation), "-i", str(src), "-c", "copy", str(out))
    src.unlink()
    return out


def make_vfr(out: Path) -> Path:
    """Vidéo à cadence variable : des images sont retirées de façon irrégulière."""
    _ff("-f", "lavfi", "-i", "testsrc2=s=640x360:d=6:r=30", "-f", "lavfi", "-i", "sine=f=440:d=6",
        "-vf", "select='not(eq(mod(n\\,7)\\,3))*not(eq(mod(n\\,11)\\,5))*not(between(n\\,60\\,75))'",
        "-fps_mode", "vfr", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac",
        "-shortest", str(out))
    return out


def make_long(out: Path, minutes: float = 12) -> Path:
    d = minutes * 60
    _ff("-f", "lavfi", "-i", f"gradients=s=320x180:d={d}:r=10:speed=0.004", "-f", "lavfi",
        "-i", f"anoisesrc=c=pink:r=16000:a=0.02:d={d}", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "35",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "32k", str(out))
    return out


def make_difficult_audio(out: Path) -> Path:
    """Voix + bruit fort + saturation."""
    voice = out.with_name(out.stem + "_v.wav")
    speech_track(voice, [("pause", 0.4), ("This sound is noisy and too loud.", "kal"), ("pause", 0.6),
                         ("We should still understand it.", "kal"), ("pause", 0.5)])
    noisy = out.with_name(out.stem + "_n.wav")
    _ff("-i", str(voice), "-f", "lavfi", "-i", "anoisesrc=c=white:r=48000:a=0.08",
        "-filter_complex", "[0][1]amix=inputs=2:duration=first:normalize=0,volume=6", "-c:a", "pcm_s16le", str(noisy))
    dur = ffmpeg.probe(noisy).duration
    make_clip(out, 640, 360, [("gradient_froid", round(dur, 2))], audio=noisy)
    voice.unlink()
    noisy.unlink()
    return out


def make_corrupted(out: Path, source: Path) -> Path:
    data = source.read_bytes()
    out.write_bytes(data[: len(data) // 3])  # moov en tête (faststart) : le flux est tronqué
    return out
