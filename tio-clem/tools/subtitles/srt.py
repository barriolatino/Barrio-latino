"""Sous-titres : découpage, calage sur la voix, fichier .srt et lisibilité.

- Sans voix : répartis dans chaque scène selon la longueur du texte (`build_cues`).
- Avec voix (humaine ou synthèse) : placés sur le débit réel en syllabes et accrochés
  aux reprises de parole détectées dans l'audio (`sync_to_voice`).
Incrustation : libass via ffmpeg (tools/render.py), style dans config/video-style.json.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STYLE = json.loads((ROOT / "config" / "video-style.json").read_text(encoding="utf-8"))["subtitles"]
CUE_MAX_CHARS = 38
MAX_CPS = 20  # caractères par seconde au-delà desquels la lecture devient difficile


def words(text: str) -> list[str]:
    return [w for w in re.split(r"\s+", text.strip()) if re.search(r"\w", w)]


def split_cues(text: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"(?<=[.?!:,;…])\s+", text) if p.strip()]
    chunks = []
    for p in parts:
        if len(p) <= CUE_MAX_CHARS:
            chunks.append(p)
            continue
        # coupe en morceaux de longueur équilibrée plutôt qu'au remplissage
        from itertools import combinations
        ws = p.split()
        n = -(-len(p) // CUE_MAX_CHARS)
        while True:
            best = None
            for cuts in combinations(range(1, len(ws)), n - 1):
                b = (0, *cuts, len(ws))
                cand = [" ".join(ws[b[i]:b[i + 1]]) for i in range(n)]
                if max(map(len, cand)) <= CUE_MAX_CHARS and (best is None or max(map(len, cand)) < max(map(len, best))):
                    best = cand
            if best or n >= len(ws):
                break
            n += 1
        chunks.extend(best or ws)
    # regroupe les morceaux très courts
    merged = []
    for c in chunks:
        if merged and (len(c) < 12 or len(merged[-1]) < 12) and len(merged[-1]) + 1 + len(c) <= 24:
            merged[-1] = f"{merged[-1]} {c}"
        else:
            merged.append(c)
    return merged


def two_lines(text: str, width: int = 24) -> str:
    if len(text) <= width:
        return text
    ws = text.split()
    best = min(range(1, len(ws)), key=lambda i: abs(len(" ".join(ws[:i])) - len(" ".join(ws[i:]))))
    return " ".join(ws[:best]) + "\n" + " ".join(ws[best:])


def syllables(text: str) -> int:
    """Nombre approximatif de syllabes prononcées (français), pour caler la voix."""
    n = 0
    for tok in re.findall(r"[\wÀ-ÿ']+", text.lower()):
        if tok.isdigit():
            n += {1: 1, 2: 3, 3: 4}.get(len(tok), 6)
            continue
        tok = re.sub(r"(es|e|ent)$", "", tok) if len(tok) > 3 else tok
        n += max(1, len(re.findall(r"[aeiouyàâäéèêëîïôöûùüœ]+", tok)))
    return n


def speech_segments(length: float, pauses: list[tuple[float, float]]) -> list[tuple[float, float]]:
    segs, prev = [], 0.0
    for a, b in pauses:
        if a - prev > 0.05:
            segs.append((prev, a))
        prev = b
    if length - prev > 0.05:
        segs.append((prev, length))
    return segs


def sync_to_voice(scenes: list[dict], length: float, pauses: list[tuple[float, float]]):
    """Cale scènes et sous-titres sur la voix off.

    On suppose un débit constant en syllabes pendant la parole (pauses exclues),
    ce qui donne l'instant estimé de chaque morceau de sous-titre ; cet instant est
    ensuite accroché au début de segment de parole le plus proche. Les scènes
    changent dans la pause qui précède leur premier sous-titre.
    Renvoie les cues [(début, fin, texte)] et fixe la durée de chaque scène.
    """
    segs = speech_segments(length, pauses)
    speech = sum(b - a for a, b in segs)
    chunks = [(i, c) for i, sc in enumerate(scenes) for c in split_cues(sc.get("voiceover", ""))]
    total = sum(syllables(c) for _, c in chunks) or 1

    def at(pos):
        x = pos / total * speech
        for a, b in segs:
            if x <= b - a + 1e-9:
                return a + x
            x -= b - a
        return segs[-1][1]

    starts, pos = [], 0
    for _, c in chunks:
        t = at(pos)
        near = [a for a, _ in segs if abs(a - t) <= 0.6]
        t = min(near, key=lambda a: abs(a - t)) if near else t
        if starts and t <= starts[-1] + 0.3:
            t = max(at(pos), starts[-1] + 0.3)
        starts.append(t)
        pos += syllables(c)
    # changement de scène : milieu de la pause juste avant le premier sous-titre de la scène
    cuts = []
    for k in range(1, len(chunks)):
        if chunks[k][0] != chunks[k - 1][0]:
            pause = [(a + b) / 2 for a, b in pauses if b <= starts[k] + 0.01 and a >= starts[k - 1]]
            cuts.append(max(pause) if pause else starts[k] - 0.05)
    t0 = 0.0
    for sc, e in zip(scenes, [*cuts, length]):
        sc["duration"] = round((e - t0) * 30) / 30
        t0 += sc["duration"]
    # un sous-titre de moins de 0,6 s est illisible : on le fusionne avec son voisin
    # de la même scène (le suivant de préférence), si le texte reste court
    items = [[sc, c, t] for (sc, c), t in zip(chunks, starts)]

    def end(k):
        return items[k + 1][2] if k + 1 < len(items) else length

    k = 0
    while k < len(items):
        if end(k) - items[k][2] < 0.6:
            if k + 1 < len(items) and items[k + 1][0] == items[k][0] and len(items[k][1]) + len(items[k + 1][1]) < 42:
                items[k][1] = f"{items[k][1]} {items[k + 1][1]}"
                del items[k + 1]
                continue
            if k > 0 and items[k - 1][0] == items[k][0] and len(items[k - 1][1]) + len(items[k][1]) < 42:
                items[k - 1][1] = f"{items[k - 1][1]} {items[k][1]}"
                del items[k]
                k -= 1
                continue
            # sinon il s'affiche un peu plus tôt, en prenant sur le précédent (mieux vaut
            # un texte légèrement en avance qu'en retard sur la voix)
            if k > 0:
                shift = min(0.6 - (end(k) - items[k][2]), items[k][2] - items[k - 1][2] - 0.8)
                if shift > 0:
                    items[k][2] -= shift
        k += 1
    lead = 0.08  # le texte apparaît un poil avant le son, comme en sous-titrage pro
    cues = []
    for k, (_, c, t) in enumerate(items):
        a = max(0.0, t - lead)
        b = (items[k + 1][2] - lead) if k + 1 < len(items) else length
        text = two_lines(c).replace(" ?", " ?").replace(" !", " !").replace(" :", " :")
        cues.append((round(a, 2), round(b, 2), text))
    return cues


def build_cues(scenes: list[dict]) -> list[tuple[float, float, str]]:
    """Sous-titres sans voix off : répartis dans chaque scène selon la longueur du texte."""
    cues, t = [], 0.0
    for sc in scenes:
        chunks = split_cues(sc.get("voiceover", ""))
        start, end = t + 0.05, t + sc["duration"] - 0.12
        total = sum(len(c) for c in chunks) or 1
        cur = start
        for c in chunks:
            span = (end - start) * len(c) / total
            text = two_lines(c).replace(" ?", "\u00A0?").replace(" !", "\u00A0!").replace(" :", "\u00A0:")
            cues.append((round(cur, 2), round(cur + span, 2), text))
            cur += span
        t += sc["duration"]
    return cues


def srt_time(t: float) -> str:
    ms = round(t * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(cues, path: Path) -> None:
    blocks = [f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{txt}\n" for i, (a, b, txt) in enumerate(cues, 1)]
    path.write_text("\n".join(blocks), encoding="utf-8")


def parse_srt(path: Path):
    cues = []
    for block in re.split(r"\n\s*\n", path.read_text(encoding="utf-8").strip()):
        lines = block.splitlines()
        m = re.match(r"(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)", lines[1] if len(lines) > 1 else "")
        if not m:
            raise ValueError(f"bloc SRT invalide : {block[:40]!r}")
        g = list(map(int, m.groups()))
        cues.append((g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000,
                     g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000, "\n".join(lines[2:])))
    return cues


def readability(cues: list[tuple[float, float, str]], duration: float | None = None) -> dict:
    """Règles de lecture sur mobile : lignes, durée d'affichage, vitesse, chevauchements."""
    errors, warnings, fast = [], [], []
    for i, (a, b, txt) in enumerate(cues, 1):
        lines = txt.splitlines()
        if b <= a:
            errors.append(f"sous-titre {i} de durée nulle")
            continue
        if i > 1 and a < cues[i - 2][1] - 0.001:
            errors.append(f"sous-titre {i} chevauche le précédent")
        if len(lines) > STYLE["max_lines"] or any(len(l) > STYLE["max_chars_per_line"] for l in lines):
            errors.append(f"sous-titre {i} trop long pour l'écran")
        if b - a < STYLE["min_display_s"] - 0.01:
            warnings.append(f"sous-titre {i} affiché {b - a:.2f} s (min {STYLE['min_display_s']} s)")
        cps = len(txt.replace("\n", "")) / (b - a)
        if cps > MAX_CPS:
            fast.append((i, cps))
    if fast:
        warnings.append(f"{len(fast)} sous-titre(s) au-delà de {MAX_CPS} caractères/s (jusqu'à "
                        f"{max(c for _, c in fast):.0f}) : débit de voix rapide, texte difficile à lire en entier")
    if duration is not None and cues and cues[-1][1] > duration + 0.05:
        errors.append("sous-titres au-delà de la fin de la vidéo")
    return {"errors": errors, "warnings": warnings}
