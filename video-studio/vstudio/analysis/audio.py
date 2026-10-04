"""Analyse audio : activité sonore, silences, niveau, saturation, bruit de fond."""

from __future__ import annotations

import json
import re

import numpy as np

from .. import ffmpeg

RATE = 16000
HOP = 0.02  # 20 ms


def frame_db(samples: np.ndarray, hop: float = HOP, rate: int = RATE) -> np.ndarray:
    n = int(rate * hop)
    if len(samples) < n:
        return np.full(1, -90.0)
    k = len(samples) // n
    frames = samples[: k * n].reshape(k, n)
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms + 1e-9)


def activity_regions(db: np.ndarray, threshold: float, min_gap: float = 0.25,
                     min_len: float = 0.12, hop: float = HOP) -> list[list[float]]:
    """Zones où le niveau dépasse le seuil, fusionnées si l'écart est court."""
    active = db > threshold
    regions: list[list[float]] = []
    start = None
    for i, a in enumerate(active):
        if a and start is None:
            start = i
        elif not a and start is not None:
            regions.append([start * hop, i * hop])
            start = None
    if start is not None:
        regions.append([start * hop, len(active) * hop])
    merged: list[list[float]] = []
    for r in regions:
        if merged and r[0] - merged[-1][1] < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [[round(a, 3), round(b, 3)] for a, b in merged if b - a >= min_len]


def loudness(path: str, log=None) -> dict:
    """Mesure EBU R128 (intensité intégrée, plage, crête vraie) via loudnorm."""
    err = ffmpeg.run_filter_log(["-i", str(path), "-vn", "-af",
                                 "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], log=log)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S)
    if not m:
        return {}
    d = json.loads(m.group(0))

    def f(k):
        try:
            v = float(d[k])
            return v if np.isfinite(v) else None
        except (KeyError, ValueError):
            return None
    return {"integrated_lufs": f("input_i"), "true_peak_dbtp": f("input_tp"),
            "lra": f("input_lra"), "threshold": f("input_thresh")}


def analyze_audio(path: str, duration: float, log=None) -> dict:
    samples = ffmpeg.read_audio_mono(path, RATE)
    if samples.size == 0:
        return {"present": False}
    db = frame_db(samples)
    floor = float(np.percentile(db, 10))
    peak_db = float(np.percentile(db, 99))
    # seuil adaptatif : au-dessus du bruit de fond, jamais absurdement bas
    threshold = max(floor + 10.0, min(peak_db - 25.0, -38.0), -55.0)
    regions = activity_regions(db, threshold)
    active_time = sum(b - a for a, b in regions)
    clip_ratio = float(np.mean(np.abs(samples) >= 0.995))
    silent = peak_db < -60
    ld = loudness(path, log) if not silent else {}
    issues = []
    if silent:
        issues.append("piste audio silencieuse")
    if clip_ratio > 0.0005:
        issues.append(f"saturation détectée ({clip_ratio * 100:.2f} % d'échantillons écrêtés)")
    if floor > -45 and not silent:
        issues.append(f"bruit de fond élevé (≈ {floor:.0f} dBFS)")
    if ld.get("integrated_lufs") is not None and ld["integrated_lufs"] < -35:
        issues.append(f"niveau très faible ({ld['integrated_lufs']:.0f} LUFS)")
    # pauses (silences entre zones actives) — utiles au montage
    pauses = []
    prev = 0.0
    for a, b in regions:
        if a - prev > 0.3:
            pauses.append([round(prev, 3), round(a, 3)])
        prev = b
    if duration - prev > 0.3:
        pauses.append([round(prev, 3), round(duration, 3)])
    return {
        "present": True,
        "silent": silent,
        "noise_floor_db": round(floor, 1),
        "peak_db": round(peak_db, 1),
        "threshold_db": round(threshold, 1),
        "active_regions": regions,
        "active_ratio": round(active_time / max(duration, 1e-6), 3),
        "pauses": pauses,
        "clip_ratio": clip_ratio,
        "loudness": ld,
        "issues": issues,
    }


def onset_envelope(samples: np.ndarray, rate: int, hop: float = 0.01) -> np.ndarray:
    """Enveloppe d'attaques (flux spectral simplifié) pour la détection de tempo."""
    n = int(rate * hop)
    win = n * 4
    k = (len(samples) - win) // n
    if k <= 2:
        return np.zeros(0)
    idx = np.arange(win)[None, :] + n * np.arange(k)[:, None]
    frames = samples[idx] * np.hanning(win)[None, :]
    spec = np.abs(np.fft.rfft(frames, axis=1))
    spec = np.log1p(spec)
    flux = np.maximum(np.diff(spec, axis=0), 0).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(20) / 20, mode="same")
    return np.maximum(flux, 0)


def detect_beats(path: str, max_seconds: float = 600) -> dict:
    """Estime le tempo et la grille de temps forts d'une musique.

    Méthode : enveloppe d'attaques, autocorrélation pour le tempo (60–180 BPM),
    puis phase choisie pour maximiser l'énergie sur la grille.
    """
    rate = 22050
    s = ffmpeg.read_audio_mono(path, rate, duration=max_seconds)
    if s.size < rate * 3:
        return {"bpm": 0, "beats": [], "confidence": 0.0}
    hop = 0.01
    env = onset_envelope(s, rate, hop)
    if env.size < 300:
        return {"bpm": 0, "beats": [], "confidence": 0.0}
    env = env / (env.max() + 1e-9)
    ac = np.correlate(env, env, mode="full")[env.size - 1:]
    lags = np.arange(ac.size)
    lo, hi = int(60 / 180 / hop), int(60 / 60 / hop)
    window = ac[lo:hi] * (1 - 0.15 * ((lags[lo:hi] * hop) - 0.5) ** 2)  # léger biais vers 120 BPM
    best = int(np.argmax(window)) + lo
    period = best * hop
    conf = float(ac[best] / (ac[0] + 1e-9))
    phases = np.arange(best)
    scores = [env[p::best].sum() for p in phases]
    phase = int(np.argmax(scores)) * hop
    total = s.size / rate
    beats = list(np.round(np.arange(phase, total, period), 3))
    return {"bpm": round(60 / period, 1), "beats": [float(b) for b in beats], "confidence": round(conf, 3),
            "duration": round(total, 3)}
