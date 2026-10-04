"""Analyse visuelle : plans, exposition, netteté, mouvement, stabilité, sujet, couleur.

Les mesures sont faites sur des images réduites (160×90) : elles servent à
guider le montage, pas à juger la qualité au pixel près.
"""

from __future__ import annotations

import re
import subprocess

import numpy as np

from .. import ffmpeg

W, H = 160, 90


def scene_cuts(path: str, threshold: float = 10.0, log=None) -> list[float]:
    err = ffmpeg.run_filter_log(["-i", str(path), "-an", "-vf", f"scale=320:-2,scdet=threshold={threshold}",
                                 "-f", "null", "-"], log=log)
    return [round(float(m.group(1)), 3) for m in re.finditer(r"lavfi\.scd\.time:\s*([\d.]+)", err)]


def _laplacian_var(f: np.ndarray) -> float:
    f = f.astype(np.float32)
    lap = (-4 * f[1:-1, 1:-1] + f[:-2, 1:-1] + f[2:, 1:-1] + f[1:-1, :-2] + f[1:-1, 2:])
    return float(lap.var())


def _shift(a: np.ndarray, b: np.ndarray) -> tuple[float, float, float]:
    """Translation globale entre deux images (corrélation de phase) et fiabilité du pic."""
    fa, fb = np.fft.fft2(a - a.mean()), np.fft.fft2(b - b.mean())
    r = fa * np.conj(fb)
    r /= np.abs(r) + 1e-9
    c = np.abs(np.fft.ifft2(r))
    y, x = np.unravel_index(np.argmax(c), c.shape)
    if y > a.shape[0] // 2:
        y -= a.shape[0]
    if x > a.shape[1] // 2:
        x -= a.shape[1]
    peak = float(c.max() / (c.sum() + 1e-9))
    return float(x), float(y), peak


def read_rgb_means(path: str, fps: float = 1.0) -> np.ndarray:
    proc = subprocess.run([ffmpeg.FFMPEG, "-hide_banner", "-nostdin", "-v", "error", "-i", str(path),
                           "-vf", f"fps={fps},scale=32:18:flags=area,format=rgb24",
                           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    buf = proc.stdout
    n = len(buf) // (32 * 18 * 3)
    if n == 0:
        return np.zeros((0, 3))
    arr = np.frombuffer(buf[: n * 32 * 18 * 3], dtype=np.uint8).reshape(n, 18 * 32, 3).astype(np.float32)
    return arr.mean(axis=1)


def analyze_visual(path: str, duration: float, log=None) -> dict:
    fps = 5.0 if duration <= 600 else 2.0
    frames = ffmpeg.read_gray_frames(path, fps, W, H)
    n = len(frames)
    if n == 0:
        return {"error": "aucune image décodée"}
    fl = frames.astype(np.float32)
    luma = fl.mean(axis=(1, 2))
    std = fl.std(axis=(1, 2))
    over = (frames >= 250).mean(axis=(1, 2))
    under = (frames <= 16).mean(axis=(1, 2))
    sharp = np.array([_laplacian_var(f) for f in frames])
    motion = np.zeros(n)
    if n > 1:
        motion[1:] = np.abs(np.diff(fl, axis=0)).mean(axis=(1, 2))
    # stabilité : translation globale image à image, on garde la composante rapide (tremblement)
    shifts = np.zeros((n, 3))
    step = max(1, n // 400)
    for i in range(step, n, step):
        shifts[i] = _shift(fl[i], fl[i - step])
    times = np.arange(n) / fps

    cuts = scene_cuts(path, log=log)
    bounds = [0.0] + [c for c in cuts if 0.3 < c < duration - 0.3] + [duration]
    shots = []
    for k in range(len(bounds) - 1):
        a, b = bounds[k], bounds[k + 1]
        idx = np.where((times >= a) & (times < b))[0]
        if idx.size == 0:
            idx = np.array([min(int(a * fps), n - 1)])
        s = _shot_stats(idx, luma, std, over, under, sharp, motion, shifts, frames, fps)
        s.update(start=round(a, 3), end=round(b, 3), index=k)
        shots.append(s)

    rgb = read_rgb_means(path)
    cast = {}
    if rgb.size:
        m = rgb.mean(axis=0)
        g = m.mean() + 1e-6
        cast = {"r": round(float(m[0] / g), 3), "g": round(float(m[1] / g), 3), "b": round(float(m[2] / g), 3)}

    return {
        "sample_fps": fps,
        "frames": int(n),
        "mean_luma": round(float(luma.mean()), 1),
        "median_sharpness": round(float(np.median(sharp)), 1),
        "mean_motion": round(float(motion.mean()), 2),
        "scene_cuts": cuts,
        "shots": shots,
        "color_cast": cast,
        "luma_curve": [round(float(x), 1) for x in luma[:: max(1, n // 200)]],
        "motion_curve": [round(float(x), 2) for x in motion[:: max(1, n // 200)]],
        "curve_step": round(max(1, n // 200) / fps, 3),
    }


def _shot_stats(idx, luma, std, over, under, sharp, motion, shifts, frames, fps) -> dict:
    l, sd = float(luma[idx].mean()), float(std[idx].mean())
    mot = float(motion[idx].mean())
    sh = shifts[idx]
    jitter = 0.0
    # un tremblement de caméra = translation globale nette (pic de corrélation franc) ;
    # un contenu qui bouge (foule, eau, fractale) donne un pic diffus : on l'ignore
    reliable = sh[sh[:, 2] > 0.02]
    if len(reliable) > 6:
        d = np.linalg.norm(reliable[:, :2], axis=1)
        jitter = float(np.std(d - np.convolve(d, np.ones(5) / 5, mode="same")))
    issues = []
    if l < 22 and sd < 12:
        issues.append("image noire ou quasi noire")
    elif l < 45:
        issues.append("sous-exposé")
    if float(over[idx].mean()) > 0.25:
        issues.append("surexposé (hautes lumières brûlées)")
    if len(idx) >= int(2 * fps) and float(motion[idx][1:].max(initial=0)) < 0.15:
        issues.append("image figée")
    if jitter > 1.2:
        issues.append("instable (tremblements)")
    # sujet : où se concentre l'énergie (mouvement + détails) horizontalement
    f = frames[idx].astype(np.float32)
    detail = np.abs(np.diff(f, axis=2)).mean(axis=(0, 1))
    mov = np.abs(np.diff(f, axis=0)).mean(axis=(0, 1)) if len(idx) > 1 else np.zeros(W)
    prof = np.concatenate([[0], detail]) * 0.4 + mov * 1.0 + 1e-6
    prof = np.convolve(prof, np.ones(9) / 9, mode="same")
    win = int(W * (9 / 16) / (16 / 9))  # largeur d'un recadrage 9:16 dans une image 16:9
    sums = np.convolve(prof, np.ones(win), mode="valid")
    best = int(np.argmax(sums))
    concentration = float(sums[best] / prof.sum())
    centre = (best + win / 2) / W
    return {
        "luma": round(l, 1),
        "contrast": round(sd, 1),
        "sharpness": round(float(sharp[idx].mean()), 1),
        "motion": round(mot, 2),
        "jitter": round(jitter, 2),
        "overexposed": round(float(over[idx].mean()), 3),
        "underexposed": round(float(under[idx].mean()), 3),
        "subject_x": round(centre, 3),
        "subject_confidence": round(concentration, 3),
        "signature": [round(float(x), 1) for x in frames[idx[len(idx) // 2]][::15, ::16].flatten()],
        "issues": issues,
    }


def thumbnails(path: str, shots: list[dict], out_dir, prefix: str, limit: int = 40) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    names = []
    for s in shots[:limit]:
        t = (s["start"] + s["end"]) / 2
        name = f"{prefix}_plan{s['index'] + 1:02d}.jpg"
        subprocess.run([ffmpeg.FFMPEG, "-hide_banner", "-nostdin", "-v", "error", "-y", "-ss", f"{t:.3f}",
                        "-i", str(path), "-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "4",
                        str(out_dir / name)], capture_output=True)
        if (out_dir / name).exists():
            names.append(name)
    return names
