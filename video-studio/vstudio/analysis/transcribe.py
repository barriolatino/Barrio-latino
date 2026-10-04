"""Transcription de la parole, avec moteurs interchangeables.

Moteurs, par ordre de préférence :
  1. « fourni »         : fichier .srt/.vtt déposé à côté du rush (même nom) — prioritaire.
  2. « faster-whisper » : multilingue, détection de langue. Nécessite un modèle local
                          (variable VSTUDIO_WHISPER_MODEL = nom ou dossier du modèle).
  3. « pocketsphinx »   : hors ligne, modèle anglais inclus, qualité modeste.
  4. aucun              : pas de sous-titres automatiques ; le système le signale.

Règle : aucun mot n'est inventé. Les mots à faible confiance sont marqués
« incertain » et listés dans le rapport pour vérification humaine.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import numpy as np

from .. import ffmpeg

UNCERTAIN = 0.35


def available_engines() -> dict[str, str]:
    out = {}
    try:
        import faster_whisper  # noqa: F401
        model = os.environ.get("VSTUDIO_WHISPER_MODEL", "")
        if model:
            out["faster-whisper"] = f"modèle {model}"
        else:
            out["faster-whisper"] = "installé, mais aucun modèle configuré (VSTUDIO_WHISPER_MODEL)"
    except ImportError:
        pass
    try:
        import pocketsphinx  # noqa: F401
        out["pocketsphinx"] = "modèle anglais (en-us) inclus"
    except ImportError:
        pass
    return out


def choose_engine(lang: str) -> tuple[str | None, str]:
    eng = available_engines()
    if "faster-whisper" in eng and os.environ.get("VSTUDIO_WHISPER_MODEL"):
        return "faster-whisper", ""
    if "pocketsphinx" in eng and lang in ("en", "auto"):
        note = "" if lang == "en" else ("langue non précisée : pocketsphinx ne reconnaît que l'anglais. "
                                         "Précisez --lang si la vidéo n'est pas en anglais.")
        return "pocketsphinx", note
    reason = ("aucun moteur de transcription disponible pour la langue « %s ». Installez un modèle "
              "Whisper (voir docs/INSTALLATION.md) ou déposez un fichier .srt à côté du rush." % lang)
    return None, reason


# ----------------------------------------------------------------------------- SRT / VTT
_TS = re.compile(r"(\d+):(\d\d):(\d\d)[,.](\d{1,3})")


def _ts(s: str) -> float:
    m = _TS.search(s)
    if not m:
        raise ValueError(s)
    h, mi, se, ms = m.groups()
    return int(h) * 3600 + int(mi) * 60 + int(se) + int(ms.ljust(3, "0")) / 1000


def parse_subtitle_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8-sig", errors="replace").replace("\r", "")
    cues = []
    for block in re.split(r"\n\s*\n", text):
        lines = [ln for ln in block.strip().split("\n") if ln.strip()]
        for i, ln in enumerate(lines):
            if "-->" in ln:
                a, b = ln.split("-->")
                body = " ".join(lines[i + 1:])
                body = re.sub(r"<[^>]+>", "", body).strip()
                if body:
                    cues.append({"start": _ts(a), "end": _ts(b), "text": body})
                break
    return cues


def from_cues(cues: list[dict], provenance: str) -> dict:
    segs = []
    for c in cues:
        words = c["text"].split()
        n = len(words)
        dur = c["end"] - c["start"]
        ws = [{"w": w, "start": round(c["start"] + dur * i / n, 3), "end": round(c["start"] + dur * (i + 1) / n, 3),
               "conf": 1.0} for i, w in enumerate(words)]
        segs.append({"start": c["start"], "end": c["end"], "text": c["text"], "words": ws, "uncertain": []})
    return {"engine": "fourni", "provenance": provenance, "lang": "", "segments": segs,
            "word_timing": "approximative (répartie dans chaque sous-titre fourni)"}


# ----------------------------------------------------------------------------- pocketsphinx
def _sphinx(path: str, regions: list[list[float]]) -> dict:
    from pocketsphinx import Decoder

    dec = Decoder(samprate=16000, loglevel="FATAL") if _has_loglevel() else Decoder(samprate=16000)
    audio = ffmpeg.read_audio_mono(path, 16000)
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    segs = []
    for a, b in regions:
        a0, b0 = max(0.0, a - 0.1), b + 0.1
        chunk = pcm[int(a0 * 16000): int(b0 * 16000)]
        if chunk.size < 1600:
            continue
        dec.start_utt()
        dec.process_raw(chunk.tobytes(), full_utt=True)
        dec.end_utt()
        words = []
        for s in dec.seg():
            w = re.sub(r"\(\d+\)$", "", s.word)
            if w.startswith("<") or w.startswith("[") or w.startswith("+"):
                continue
            words.append({"w": w, "start": round(a0 + s.start_frame / 100, 3),
                          "end": round(a0 + (s.end_frame + 1) / 100, 3), "conf": round(float(s.prob), 3)})
        segs += _split_sentences(words)
    return {"engine": "pocketsphinx", "provenance": "transcription automatique (pocketsphinx, en-us)",
            "lang": "en", "segments": segs, "word_timing": "par mot"}


def _has_loglevel() -> bool:
    try:
        from pocketsphinx import Decoder
        Decoder(samprate=16000, loglevel="FATAL")
        return True
    except Exception:
        return False


# ----------------------------------------------------------------------------- faster-whisper
def _whisper(path: str, lang: str) -> dict:
    from faster_whisper import WhisperModel

    model_name = os.environ["VSTUDIO_WHISPER_MODEL"]
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(path, language=None if lang == "auto" else lang,
                                      word_timestamps=True, vad_filter=True)
    words = []
    for s in segments:
        for w in s.words or []:
            words.append({"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3),
                          "conf": round(float(w.probability), 3)})
    return {"engine": "faster-whisper", "provenance": f"transcription automatique (faster-whisper, {model_name})",
            "lang": info.language, "lang_probability": round(info.language_probability, 3),
            "segments": _split_sentences(words), "word_timing": "par mot"}


def _split_sentences(words: list[dict], pause: float = 0.55, max_len: float = 12.0) -> list[dict]:
    segs, cur = [], []
    for w in words:
        if cur and (w["start"] - cur[-1]["end"] > pause or w["end"] - cur[0]["start"] > max_len
                    or re.search(r"[.!?…]$", cur[-1]["w"])):
            segs.append(cur)
            cur = []
        cur.append(w)
    if cur:
        segs.append(cur)
    out = []
    for ws in segs:
        out.append({"start": ws[0]["start"], "end": ws[-1]["end"], "text": " ".join(x["w"] for x in ws),
                    "words": ws, "uncertain": [x["w"] for x in ws if x["conf"] < UNCERTAIN]})
    return out


def transcribe(path: str, lang: str, regions: list[list[float]], sidecar: Path | None) -> dict:
    if sidecar and sidecar.exists():
        return from_cues(parse_subtitle_file(sidecar), "fichier de sous-titres fourni par l'utilisateur")
    engine, note = choose_engine(lang)
    if engine is None:
        return {"engine": None, "segments": [], "note": note}
    if not regions:
        return {"engine": engine, "segments": [], "note": "aucune parole détectée"}
    result = _whisper(path, lang) if engine == "faster-whisper" else _sphinx(path, regions)
    if note:
        result["note"] = note
    return result
