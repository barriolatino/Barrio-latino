"""Accès à FFmpeg/FFprobe : exécution, sondage des médias, lecture d'images brutes."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path

from .errors import FFmpegError, MediaError

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"


def check_tools() -> None:
    for tool in (FFMPEG, FFPROBE):
        if not shutil.which(tool):
            raise FFmpegError(
                f"L'outil {Path(tool).name} est introuvable.",
                hint="Installez FFmpeg (ex. : sudo apt install ffmpeg) puis relancez.",
            )


def run(args: list[str], *, log=None, check: bool = True, timeout: float | None = None,
        capture: bool = True) -> subprocess.CompletedProcess:
    """Lance ffmpeg avec des options sûres (pas d'interaction, erreurs seulement)."""
    cmd = [FFMPEG, "-hide_banner", "-nostdin", "-y", *args]
    if log:
        log.debug("ffmpeg " + " ".join(_quote(a) for a in args))
    proc = subprocess.run(cmd, capture_output=capture, text=True, timeout=timeout)
    if check and proc.returncode != 0:
        tail = "\n".join((proc.stderr or "").strip().splitlines()[-15:])
        if log:
            log.debug(f"ffmpeg a échoué (code {proc.returncode}) :\n{tail}")
        raise FFmpegError(
            "Le traitement FFmpeg a échoué.",
            hint="Consultez le journal du projet (journal.log) pour le détail technique.",
            details=tail,
        )
    return proc


def run_filter_log(args: list[str], *, log=None, timeout: float | None = None) -> str:
    """Lance ffmpeg en analyse (sortie nulle) et renvoie stderr, où les filtres écrivent."""
    proc = run(["-loglevel", "info", *args], log=log, check=False, timeout=timeout)
    if proc.returncode != 0:
        tail = "\n".join((proc.stderr or "").strip().splitlines()[-10:])
        raise FFmpegError("L'analyse FFmpeg a échoué.", details=tail)
    return proc.stderr or ""


def _quote(a: str) -> str:
    return a if re.fullmatch(r"[\w.,:=/+@%-]+", a) else repr(a)


@dataclass
class MediaInfo:
    path: str
    duration: float
    format_name: str
    size_bytes: int
    has_video: bool = False
    has_audio: bool = False
    width: int = 0
    height: int = 0
    display_width: int = 0
    display_height: int = 0
    rotation: int = 0
    fps: float = 0.0
    avg_fps: float = 0.0
    vfr: bool = False
    vcodec: str = ""
    pix_fmt: str = ""
    color_space: str = ""
    nb_frames: int = 0
    acodec: str = ""
    sample_rate: int = 0
    channels: int = 0
    audio_duration: float = 0.0
    video_duration: float = 0.0
    warnings: list[str] = field(default_factory=list)

    @property
    def orientation(self) -> str:
        if not self.has_video:
            return "audio"
        w, h = self.display_width, self.display_height
        if abs(w - h) <= max(w, h) * 0.05:
            return "carré"
        return "vertical" if h > w else "horizontal"

    def to_dict(self) -> dict:
        d = dict(self.__dict__)
        d["orientation"] = self.orientation
        return d


def _fraction(s: str | None) -> float:
    if not s or s in ("0/0", "N/A"):
        return 0.0
    try:
        return float(Fraction(s))
    except (ValueError, ZeroDivisionError):
        return 0.0


def probe(path: str | Path, log=None) -> MediaInfo:
    path = Path(path)
    if not path.exists():
        raise MediaError(f"Fichier introuvable : {path}")
    if path.stat().st_size == 0:
        raise MediaError(f"Le fichier {path.name} est vide (0 octet).",
                         hint="Recopiez le fichier depuis la source d'origine.")
    cmd = [FFPROBE, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise MediaError(
            f"Le fichier {path.name} est illisible ou corrompu.",
            hint="Vérifiez que la copie est complète ; réexportez-le depuis l'appareil si besoin.",
            details=proc.stderr.strip()[-800:],
        )
    data = json.loads(proc.stdout or "{}")
    fmt = data.get("format", {})
    streams = data.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"
              and not s.get("disposition", {}).get("attached_pic")), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    duration = float(fmt.get("duration") or 0)
    info = MediaInfo(path=str(path), duration=duration, format_name=fmt.get("format_name", ""),
                     size_bytes=int(fmt.get("size") or path.stat().st_size))
    if v:
        info.has_video = True
        info.width, info.height = int(v.get("width", 0)), int(v.get("height", 0))
        rot = 0
        for sd in v.get("side_data_list", []) or []:
            if "rotation" in sd:
                rot = int(round(float(sd["rotation"])))
        if not rot and "rotate" in (v.get("tags") or {}):
            rot = -int(v["tags"]["rotate"])
        info.rotation = rot % 360
        if info.rotation in (90, 270):
            info.display_width, info.display_height = info.height, info.width
        else:
            info.display_width, info.display_height = info.width, info.height
        info.fps = _fraction(v.get("r_frame_rate"))
        info.avg_fps = _fraction(v.get("avg_frame_rate"))
        if info.fps and info.avg_fps and abs(info.fps - info.avg_fps) / info.fps > 0.02:
            info.vfr = True
        elif _irregular_timestamps(path):
            info.vfr = True
        info.vcodec = v.get("codec_name", "")
        info.pix_fmt = v.get("pix_fmt", "")
        info.color_space = v.get("color_space", "")
        info.nb_frames = int(v.get("nb_frames") or 0)
        info.video_duration = float(v.get("duration") or duration)
    if a:
        info.has_audio = True
        info.acodec = a.get("codec_name", "")
        info.sample_rate = int(a.get("sample_rate") or 0)
        info.channels = int(a.get("channels") or 0)
        info.audio_duration = float(a.get("duration") or duration)
    if not info.has_video and not info.has_audio:
        raise MediaError(f"Le fichier {path.name} ne contient ni image ni son exploitable.")
    if duration <= 0:
        raise MediaError(f"Impossible de déterminer la durée de {path.name} (fichier incomplet ?).",
                         hint="Le fichier a peut-être été coupé pendant la copie.")
    return info


def _irregular_timestamps(path: Path, seconds: int = 10) -> bool:
    """Cadence variable : écarts entre horodatages d'images irréguliers (sur les premières secondes)."""
    proc = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-read_intervals", f"%+{seconds}",
                           "-show_entries", "packet=pts_time", "-of", "csv=p=0", str(path)],
                          capture_output=True, text=True)
    ts = sorted(float(x) for x in proc.stdout.split() if x.replace(".", "", 1).replace("-", "", 1).isdigit())
    if len(ts) < 10:
        return False
    deltas = [b - a for a, b in zip(ts, ts[1:]) if b > a]
    if not deltas:
        return False
    deltas.sort()
    med = deltas[len(deltas) // 2]
    irregular = sum(1 for d in deltas if abs(d - med) > med * 0.25)
    return irregular / len(deltas) > 0.03


def decode_check(path: str | Path, seconds: float | None = None, log=None) -> list[str]:
    """Décode réellement le fichier et renvoie les erreurs de décodage rencontrées."""
    args = ["-v", "error", "-i", str(path)]
    if seconds:
        args += ["-t", f"{seconds:.3f}"]
    args += ["-f", "null", "-"]
    proc = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", *args], capture_output=True, text=True)
    lines = [ln for ln in (proc.stderr or "").splitlines() if ln.strip()]
    if proc.returncode != 0 and not lines:
        lines = [f"code de sortie {proc.returncode}"]
    return lines


def read_gray_frames(path: str | Path, fps: float, width: int = 160, height: int = 90,
                     start: float | None = None, duration: float | None = None):
    """Lit des images en niveaux de gris réduites, renvoie un tableau numpy (n, h, w)."""
    import numpy as np

    args = [FFMPEG, "-hide_banner", "-nostdin", "-v", "error"]
    if start is not None:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(path)]
    if duration is not None:
        args += ["-t", f"{duration:.3f}"]
    args += ["-vf", f"fps={fps},scale={width}:{height}:flags=area,format=gray",
             "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    proc = subprocess.run(args, capture_output=True)
    buf = proc.stdout
    n = len(buf) // (width * height)
    if n == 0:
        return np.zeros((0, height, width), dtype=np.uint8)
    return np.frombuffer(buf[: n * width * height], dtype=np.uint8).reshape(n, height, width)


def read_audio_mono(path: str | Path, rate: int = 16000, start: float | None = None,
                    duration: float | None = None):
    """Décode l'audio en mono float32 (numpy)."""
    import numpy as np

    args = [FFMPEG, "-hide_banner", "-nostdin", "-v", "error"]
    if start is not None:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(path)]
    if duration is not None:
        args += ["-t", f"{duration:.3f}"]
    args += ["-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"]
    proc = subprocess.run(args, capture_output=True)
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def ffmpeg_escape_path(p: str | Path) -> str:
    """Échappe un chemin pour l'utiliser dans un graphe de filtres (subtitles=, ass=)."""
    s = str(p).replace("\\", "/")
    return s.replace(":", r"\:").replace("'", r"\'").replace(",", r"\,").replace("[", r"\[").replace("]", r"\]")
