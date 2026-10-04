"""Sous-titres : découpage lisible, typographie, export SRT/VTT/ASS, titres et habillage.

Règles appliquées :
- lignes de longueur limitée (selon le style), 2 lignes maximum, coupure de préférence
  après une ponctuation ou avant un mot de liaison ;
- durée d'affichage entre 1 s et 6 s, jamais au-delà de la fin de la phrase ;
- typographie française (espaces insécables avant « ; : ! ? » et dans les guillemets)
  quand la langue est le français ;
- aucun mot ajouté : le texte vient de la transcription (ou du fichier fourni) ;
  les mots incertains sont listés dans subtitles/a_verifier.txt.
"""

from __future__ import annotations

import re
from pathlib import Path

from . import config

NBSP, NNBSP = " ", " "
LINK_WORDS = {"et", "ou", "mais", "donc", "car", "que", "qui", "de", "du", "des", "le", "la", "les", "un", "une",
              "à", "au", "aux", "en", "pour", "avec", "dans", "sur", "the", "a", "an", "and", "or", "but", "to",
              "of", "in", "on", "for", "with", "that"}


def french_typography(text: str) -> str:
    text = re.sub(r"\s+([;!?])", NNBSP + r"\1", text)
    text = re.sub(r"(\w)([;!?])", r"\1" + NNBSP + r"\2", text)
    text = re.sub(r"\s+:", NBSP + ":", text)
    text = re.sub(r"(\w):(\s|$)", r"\1" + NBSP + r":\2", text)
    text = re.sub(r"«\s*", "«" + NBSP, text)
    text = re.sub(r"\s*»", NBSP + "»", text)
    text = text.replace("'", "’")
    return text


def tidy(text: str, engine: str | None, lang: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if engine == "pocketsphinx":  # pas de majuscules dans la sortie : on capitalise sans ajouter de mot
        text = text[:1].upper() + text[1:]
        if lang == "en":
            text = re.sub(r"\bi\b", "I", text)
    if lang == "fr":
        text = french_typography(text)
    return text


def wrap_lines(words: list[str], max_chars: int) -> list[str]:
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if len(cand) <= max_chars or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def balanced_two_lines(text: str, max_chars: int) -> list[str]:
    """Coupe en deux lignes équilibrées, de préférence après ponctuation / avant un mot de liaison."""
    if len(text) <= max_chars:
        return [text]
    if len(text) > 2 * max_chars + 1:
        return wrap_lines(text.split(" "), max_chars)
    words = text.split(" ")
    best, best_cost = None, 1e9
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        if len(a) > max_chars or len(b) > max_chars:
            continue
        cost = abs(len(a) - len(b))
        if re.search(r"[,;:.!?]$", words[i - 1]):
            cost -= 8
        if words[i].lower() in LINK_WORDS:
            cost -= 4
        if words[i - 1].lower() in LINK_WORDS:
            cost += 6
        if cost < best_cost:
            best, best_cost = [a, b], cost
    return best or wrap_lines(words, max_chars)


def _fits(words: list[dict], max_chars: int, max_lines: int, max_dur: float) -> bool:
    text = " ".join(w["w"] for w in words)
    return (len(balanced_two_lines(text, max_chars)) <= max_lines
            and words[-1]["end"] - words[0]["start"] <= max_dur)


def _split_even(words: list[dict], max_chars: int, max_lines: int, max_dur: float) -> list[list[dict]]:
    """Découpe une phrase en k sous-titres de longueurs voisines (pas de mot orphelin)."""
    for k in range(1, len(words) + 1):
        total = sum(len(w["w"]) + 1 for w in words)
        target = total / k
        chunks, cur, acc = [], [], 0.0
        for i, w in enumerate(words):
            cur.append(w)
            acc += len(w["w"]) + 1
            remaining_chunks = k - len(chunks) - 1
            if remaining_chunks > 0 and len(words) - i - 1 >= remaining_chunks:
                strong = re.search(r"[,;:.!?…]$", w["w"]) and acc >= target * 0.6
                if acc >= target or strong:
                    chunks.append(cur)
                    cur, acc = [], 0.0
        if cur:
            chunks.append(cur)
        if all(_fits(c, max_chars, max_lines, max_dur) for c in chunks):
            return chunks
    return [[w] for w in words]


def build_cues(words: list[dict], max_chars: int, max_lines: int, min_dur: float = 1.0,
               max_dur: float = 6.0, hard_end: float | None = None) -> list[dict]:
    """Regroupe des mots horodatés (temps de la timeline) en sous-titres lisibles."""
    phrases, cur = [], []
    for w in words:
        if cur and (w["start"] - cur[-1]["end"] > 0.6 or re.search(r"[.!?…]$", cur[-1]["w"])):
            phrases.append(cur)
            cur = []
        cur.append(w)
    if cur:
        phrases.append(cur)
    cues = []
    for ph in phrases:
        for chunk in _split_even(ph, max_chars, max_lines, max_dur):
            cues.append({"start": chunk[0]["start"], "end": chunk[-1]["end"],
                         "text": " ".join(x["w"] for x in chunk),
                         "uncertain": [x["w"] for x in chunk if x.get("conf", 1) < 0.35]})
    # durées minimales sans chevauchement
    for i, c in enumerate(cues):
        limit = cues[i + 1]["start"] - 0.04 if i + 1 < len(cues) else (hard_end or c["end"] + min_dur)
        if c["end"] - c["start"] < min_dur:
            c["end"] = min(c["start"] + min_dur, limit)
        if i + 1 < len(cues) and cues[i + 1]["start"] - c["end"] < 0.25:
            c["end"] = max(c["end"], cues[i + 1]["start"] - 0.04)  # évite le clignotement
    return cues


def timeline_words(timeline: dict, transcripts: dict) -> list[dict]:
    """Projette les mots des transcriptions sur le temps de la timeline."""
    out, t = [], 0.0
    td = timeline["transition_duration"]
    for c in timeline["clips"]:
        if c["transition_in"] == "fondu":
            t -= td
        d = (c["out"] - c["in"]) / c.get("speed", 1.0)
        if c["kind"] in ("parole", "teaser") and c["rush"] in transcripts:
            tr = transcripts[c["rush"]]
            for s in tr.get("segments", []):
                for w in s.get("words", []):
                    mid = (w["start"] + w["end"]) / 2
                    if c["in"] <= mid <= c["out"]:
                        a = t + max(0.0, (w["start"] - c["in"]) / c.get("speed", 1.0))
                        b = t + min(d, (w["end"] - c["in"]) / c.get("speed", 1.0))
                        out.append({"w": w["w"], "start": round(a, 3), "end": round(b, 3), "conf": w.get("conf", 1),
                                    "clip": c["id"], "clip_end": round(t + d, 3)})
        t += d
    return out


def make_cues(timeline: dict, transcripts: dict, style: dict) -> list[dict]:
    words = timeline_words(timeline, transcripts)
    cues = []
    # on ne mélange jamais deux plans dans un même sous-titre
    by_clip: dict[str, list] = {}
    for w in words:
        by_clip.setdefault(w["clip"], []).append(w)
    for clip_id, ws in by_clip.items():
        cues += build_cues(ws, style["max_chars"], style["max_lines"], hard_end=ws[-1]["clip_end"])
    lang = timeline.get("lang", "")
    engines = {tr.get("engine") for tr in transcripts.values() if tr.get("segments")}
    engine = engines.pop() if len(engines) == 1 else None
    for c in cues:
        c["text"] = tidy(c["text"], engine, lang)
        if style.get("uppercase"):
            c["text"] = c["text"].upper()
        c["lines"] = balanced_two_lines(c["text"], style["max_chars"])
    return cues


def _srt_ts(t: float, sep: str = ",") -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def write_srt(cues: list[dict], path: Path) -> None:
    blocks = [f"{i}\n{_srt_ts(c['start'])} --> {_srt_ts(c['end'])}\n" + "\n".join(c["lines"])
              for i, c in enumerate(cues, 1)]
    path.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")


def write_vtt(cues: list[dict], path: Path) -> None:
    blocks = [f"{_srt_ts(c['start'], '.')} --> {_srt_ts(c['end'], '.')}\n" + "\n".join(c["lines"]) for c in cues]
    path.write_text("WEBVTT\n\n" + "\n\n".join(blocks) + "\n", encoding="utf-8")


def _ass_ts(t: float) -> str:
    cs = int(round(max(0, t) * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _ass_color(hex6: str, alpha: float = 0.0) -> str:
    r, g, b = hex6[0:2], hex6[2:4], hex6[4:6]
    return f"&H{int(alpha * 255):02X}{b}{g}{r}"


def _esc(t: str) -> str:
    return t.replace("\\", "\\\\").replace("{", "(").replace("}", ")")


def write_ass(cues: list[dict], path: Path, timeline: dict, preset: dict, style: dict,
              watermark: str = "", only_subtitles: bool = False) -> None:
    W, H = timeline["width"], timeline["height"]
    scale = timeline.get("subtitle_scale", 1.0)
    fs = round(style["size"] * H * scale)
    outline = round(style["outline"] * H, 1)
    shadow = round(style["shadow"] * H, 1)
    margin_lr = round(max(preset["safe_left"], preset["safe_right"]) * W)
    if style["position"] == "centre-bas" and H > W:
        margin_v = round(0.30 * H)
    else:
        margin_v = round(preset["safe_bottom"] * H + 0.02 * H)
    border = 3 if style.get("box") else 1
    back = _ass_color(style.get("box_color", "000000"), 1 - style.get("box_alpha", 0.5)) if style.get("box") \
        else _ass_color("000000", 0.5)
    box_pad = round(0.008 * H) if style.get("box") else outline
    t_fs = round(0.055 * H if H > W else 0.07 * H)
    lt_fs = round(0.032 * H if H > W else 0.040 * H)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{style['font']},{fs},{_ass_color(style['color'])},&H000000FF,{_ass_color(style['outline_color'])},{back},{-1 if style['bold'] else 0},0,0,0,100,100,0,0,{border},{box_pad if border == 3 else outline},{shadow},2,{margin_lr},{margin_lr},{margin_v},1
Style: Title,DejaVu Sans,{t_fs},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,{round(0.003 * H, 1)},0,5,{margin_lr},{margin_lr},0,1
Style: Lower,DejaVu Sans,{lt_fs},&H00FFFFFF,&H000000FF,&H00000000,&H66000000,0,0,0,0,100,100,0,0,3,{round(0.01 * H)},0,1,{margin_lr},{margin_lr},{round(preset['safe_bottom'] * H + 0.16 * H)},1
Style: Mark,DejaVu Sans,{round(0.022 * H)},&H40FFFFFF,&H000000FF,&H80000000,&H00000000,-1,0,0,0,100,100,0,0,1,1,0,7,{round(0.03 * W)},0,{round(preset['safe_top'] * H)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    for c in cues:
        body = r"\N".join(_esc(x) for x in c["lines"])
        ev.append(f"Dialogue: 0,{_ass_ts(c['start'])},{_ass_ts(c['end'])},Sub,,0,0,0,,{body}")
    if not only_subtitles:
        titles = timeline.get("titles", {})
        total = timeline.get("expected_duration", 0)
        if titles.get("title"):
            ev.append(f"Dialogue: 1,{_ass_ts(0.3)},{_ass_ts(3.2)},Title,,0,0,0,,{{\\fad(350,350)\\pos({W // 2},{round(H * 0.42)})}}{_esc(titles['title'])}")
        shown = set()
        t = 0.0
        for cl in timeline["clips"]:
            if cl["transition_in"] == "fondu":
                t -= timeline["transition_duration"]
            name = titles.get("speakers", {}).get(cl["rush"])
            if name and cl["rush"] not in shown and cl["kind"] == "parole":
                shown.add(cl["rush"])
                ev.append(f"Dialogue: 1,{_ass_ts(t + 0.6)},{_ass_ts(t + 4.6)},Lower,,0,0,0,,{{\\fad(300,300)}}{_esc(name)}")
            t += (cl["out"] - cl["in"]) / cl.get("speed", 1.0)
        if titles.get("end_text") and total > 4:
            ev.append(f"Dialogue: 1,{_ass_ts(total - 3.0)},{_ass_ts(total)},Title,,0,0,0,,{{\\fad(400,0)\\pos({W // 2},{round(H * 0.45)})}}{_esc(titles['end_text'])}")
        if watermark:
            ev.append(f"Dialogue: 2,{_ass_ts(0)},{_ass_ts(max(total, 1) + 5)},Mark,,0,0,0,,{_esc(watermark)}")
    path.write_text(header + "\n".join(ev) + "\n", encoding="utf-8")


def write_review_list(cues: list[dict], path: Path, note: str = "") -> int:
    rows = [c for c in cues if c["uncertain"]]
    lines = ["Sous-titres à vérifier (mots reconnus avec une faible confiance).",
             "Corrigez transcripts/<rush>.json (mettez \"edited_by_user\": true) puis relancez « captions ».", ""]
    if note:
        lines += [note, ""]
    for c in rows:
        lines.append(f"{_srt_ts(c['start'])}  {c['text']}    ← incertain : {', '.join(c['uncertain'])}")
    if not rows:
        lines.append("Aucun mot incertain détecté.")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(rows)


def style_for(timeline: dict) -> dict:
    return config.subtitle_style(timeline["subtitle_style"])
