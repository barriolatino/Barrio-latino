"""Étape 1 — Ingestion : vérification des formats, durées, codecs et intégrité.

Les rushs originaux ne sont jamais modifiés ni déplacés : le projet garde leur
chemin et une empreinte (taille + hachage du début et de la fin du fichier)
pour détecter un fichier remplacé ou doublonné.
"""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

from . import ffmpeg
from .errors import MediaError
from .project import Project

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts", ".m2ts", ".3gp", ".mxf"}
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus"}


def fingerprint(path: Path) -> str:
    h = hashlib.sha1()
    size = path.stat().st_size
    h.update(str(size).encode())
    with open(path, "rb") as f:
        h.update(f.read(1 << 20))
        if size > (2 << 20):
            f.seek(-(1 << 20), 2)
            h.update(f.read())
    return h.hexdigest()[:16]


def collect_files(sources: list[str | Path]) -> list[Path]:
    files: list[Path] = []
    for s in sources:
        p = Path(s).expanduser()
        if p.is_dir():
            files += sorted(f for f in p.rglob("*") if f.suffix.lower() in VIDEO_EXT and f.is_file()
                            and not f.name.startswith("."))
        elif p.is_file():
            files.append(p)
        else:
            raise MediaError(f"Introuvable : {p}", hint="Vérifiez le chemin du fichier ou du dossier.")
    return files


def ingest(project: Project, sources: list[str | Path], quick: bool = False) -> list[dict]:
    """Ajoute des rushs au projet après vérification. Renvoie les entrées ajoutées."""
    log = project.log
    files = collect_files(sources)
    if not files:
        raise MediaError("Aucune vidéo trouvée dans les sources indiquées.",
                         hint=f"Formats acceptés : {', '.join(sorted(VIDEO_EXT))}.")
    known = {r["fingerprint"]: r for r in project.state["rushes"]}
    added = []
    for f in files:
        f = f.resolve()
        entry = {"id": "", "path": str(f), "name": f.name, "status": "ok", "reason": "",
                 "provenance": "rush fourni par l'utilisateur", "warnings": []}
        try:
            fp = fingerprint(f)
        except OSError as e:
            entry.update(status="rejeté", reason=f"lecture impossible : {e}", fingerprint="")
            fp = ""
        if fp and fp in known:
            log.info(f"• {f.name} : déjà importé (identique à {known[fp]['name']}), ignoré.")
            continue
        entry["fingerprint"] = fp
        entry["id"] = f"r{len(project.state['rushes']) + 1:02d}"
        if entry["status"] == "ok":
            try:
                info = ffmpeg.probe(f)
                entry["info"] = info.to_dict()
                if not info.has_video:
                    entry.update(status="rejeté", reason="fichier audio seul (déposez-le dans assets/music/ s'il s'agit de musique)")
                else:
                    errs = _integrity(f, info, quick)
                    if errs:
                        entry.update(status="rejeté", reason="erreurs de décodage : " + "; ".join(errs[:3]))
                    entry["warnings"] = _warnings(info)
            except MediaError as e:
                entry.update(status="rejeté", reason=e.message)
                if e.details:
                    log.debug(e.details)
        sidecar = _sidecar_transcript(f)
        if sidecar and entry["status"] == "ok":
            dst = project.path("transcripts", f"{entry['id']}.source{sidecar.suffix}")
            shutil.copy2(sidecar, dst)
            entry["sidecar_transcript"] = dst.name
        project.state["rushes"].append(entry)
        known[fp] = entry
        added.append(entry)
        if entry["status"] == "ok":
            i = entry["info"]
            log.info(f"✓ {entry['id']} {f.name} — {i['duration']:.1f} s, {i['display_width']}×{i['display_height']} "
                     f"{i['orientation']}, {i['fps']:.2f} i/s, {i['vcodec']}, "
                     f"{'audio ' + i['acodec'] if i['has_audio'] else 'SANS AUDIO'}")
            for w in entry["warnings"]:
                log.info(f"    ⚠ {w}")
            if sidecar:
                log.info(f"    transcription fournie détectée : {sidecar.name}")
        else:
            log.info(f"✗ {f.name} rejeté : {entry['reason']}")
    project.save()
    project.journal(f"Ingestion : {len(added)} fichier(s), {sum(r['status'] == 'ok' for r in added)} exploitable(s)")
    return added


def _integrity(path: Path, info, quick: bool) -> list[str]:
    """Décode le début et la fin du fichier (ou tout si court) pour détecter la corruption."""
    if info.duration <= 90 and not quick:
        return _significant(ffmpeg.decode_check(path))
    errs = _significant(ffmpeg.decode_check(path, seconds=8))
    if errs:
        return errs
    # fin du fichier : un fichier tronqué casse souvent ici
    import subprocess
    proc = subprocess.run([ffmpeg.FFMPEG, "-hide_banner", "-nostdin", "-v", "error",
                           "-ss", f"{max(0, info.duration - 6):.2f}", "-i", str(path), "-f", "null", "-"],
                          capture_output=True, text=True)
    return _significant(proc.stderr.splitlines())


def _significant(lines: list[str]) -> list[str]:
    ignore = ("Last message repeated", "deprecated pixel format", "co located POCs unavailable")
    return [ln for ln in lines if ln.strip() and not any(i in ln for i in ignore)]


def _warnings(info) -> list[str]:
    w = []
    if not info.has_audio:
        w.append("pas de piste audio : le montage utilisera la musique ou un silence")
    if info.vfr:
        w.append(f"cadence variable détectée ({info.avg_fps:.2f} i/s en moyenne) : elle sera rendue constante")
    if info.rotation:
        w.append(f"rotation {info.rotation}° dans les métadonnées : appliquée automatiquement")
    if info.display_height and info.display_height < 720 and info.display_width < 720:
        w.append(f"résolution faible ({info.display_width}×{info.display_height}) : rendu agrandi, qualité limitée")
    if info.has_audio and info.audio_duration and info.video_duration and \
            abs(info.audio_duration - info.video_duration) > 0.5:
        w.append(f"durées audio ({info.audio_duration:.1f} s) et vidéo ({info.video_duration:.1f} s) différentes")
    return w


def _sidecar_transcript(video: Path) -> Path | None:
    for ext in (".srt", ".vtt"):
        c = video.with_suffix(ext)
        if c.exists():
            return c
    return None
