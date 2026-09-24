#!/usr/bin/env python3
"""Tio Clem — Content Factory.

Partie déterministe de la chaîne : le calendrier, le rendu (vidéo, cover,
slides, sous-titres), le contrôle qualité automatique, l'historique et
l'export. La recherche et l'écriture sont faites par Claude via les
commandes de .claude/commands/ (voir PLAYBOOK.md).

    python3 tioclem/factory.py calendar
    python3 tioclem/factory.py next
    python3 tioclem/factory.py build 1 [--voice voix.m4a]
    python3 tioclem/factory.py review [1|all]
    python3 tioclem/factory.py export
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
POSTS = CONTENT / "posts"
OUTPUT = ROOT / "output"
EXPORT = ROOT / "export"
CALENDAR = CONTENT / "calendar.json"
PUBLISHED = CONTENT / "published.json"

WORDS_PER_SEC = 3.0      # débit d'une voix française naturelle et rythmée
SCENE_PAUSE = 0.45       # respiration entre deux scènes
VIDEO_MIN, VIDEO_MAX = 20.0, 45.0
HOOK_MAX = 3.6
SLIDES_MIN, SLIDES_MAX = 7, 9
HASHTAGS_MIN, HASHTAGS_MAX = 5, 8
CUE_MAX_CHARS = 38
HEDGES = ("hypothèse", "selon", "on pense", "aurait", "auraient", "légende", "tradition",
          "on raconte", "peut-être", "probablement", "on suppose", "il semble")
WINNER_WORDS = ("le gagnant", "la gagnante", "a gagné", "est meilleur que", "est meilleure que")

READY, REVIEW = "READY_TO_PUBLISH", "NEEDS_REVIEW"


# ---------------------------------------------------------------- utilitaires

def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fold(text: str) -> str:
    """Minuscules sans accents, pour comparer."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def words(text: str) -> list[str]:
    return [w for w in re.split(r"\s+", text.strip()) if re.search(r"\w", w)]


def calendar() -> dict:
    return load(CALENDAR)


def day_entry(day: int) -> dict:
    for d in calendar()["days"]:
        if d["day"] == day:
            return d
    sys.exit(f"Jour {day} absent du calendrier.")


def post_path(day: int) -> Path:
    return POSTS / f"day-{day:02d}.json"


def out_dir(post: dict) -> Path:
    return OUTPUT / f"{post['date']}-{post['slug']}"


def history() -> dict:
    return load(PUBLISHED) if PUBLISHED.exists() else {"publications": []}


# ---------------------------------------------------------------- corrections automatiques

def fix_typo(text: str) -> str:
    text = text.replace("’", "'")
    text = re.sub(r"[   ]*([?!;:])", r" \1", text)      # espace avant ? ! ; :
    text = re.sub(r" :(?=//)", ":", text)                          # URLs
    text = re.sub(r"(\d) :(\d)", r"\1:\2", text)                   # heures
    text = re.sub(r"([?!]) (?=[?!])", r"\1", text)                 # « ?! »
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\b(\w+) \1\b", r"\1", text, flags=re.IGNORECASE)  # mot doublé
    text = re.sub(r"\.{3}", "…", text)
    return text.strip() if "\n" not in text else "\n".join(l.strip() for l in text.split("\n"))


def fix_hashtags(tags: list[str]) -> list[str]:
    seen, out = set(), []
    for t in tags:
        bare = "".join(c for c in unicodedata.normalize("NFD", t.lstrip("#")) if unicodedata.category(c) != "Mn")
        if " " in bare:
            bare = "".join(w[:1].upper() + w[1:] for w in bare.split())
        t = "#" + re.sub(r"[^A-Za-z0-9_]", "", bare)
        if len(t) > 1 and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    if "#tioclem" not in seen:
        out.insert(1 if out else 0, "#TioClem")
    return out[:HASHTAGS_MAX]


def autofix(post: dict) -> list[str]:
    """Corrige ce qui peut l'être sans jugement éditorial. Renvoie le journal."""
    log = []

    def fix(obj, key, where):
        if isinstance(obj.get(key), str):
            new = fix_typo(obj[key])
            if new != obj[key]:
                log.append(f"typographie corrigée : {where}")
                obj[key] = new

    for k in ("caption", "cta", "question", "title"):
        fix(post, k, k)
    for i, h in enumerate(post.get("hooks", [])):
        post["hooks"][i] = fix_typo(h)
    for sc in post.get("scenes", []) + post.get("slides", []):
        fix(sc, "voiceover", f"{sc.get('id')}.voiceover")
        fix(sc, "body", f"{sc.get('id')}.body")
        if "on_screen" in sc:
            for k in ("title", "subtitle"):
                fix(sc["on_screen"], k, f"{sc.get('id')}.{k}")
    if post.get("hashtags"):
        fixed = fix_hashtags(post["hashtags"])
        if fixed != post["hashtags"]:
            log.append(f"hashtags corrigés : {' '.join(fixed)}")
            post["hashtags"] = fixed
    # le texte de la cover doit tenir en 3 à 7 mots
    cover = post.get("cover", {})
    if cover.get("text") and len(words(cover["text"])) > 7:
        cover["text"] = " ".join(words(cover["text"])[:7])
        log.append("cover raccourcie à 7 mots")
    return log


# ---------------------------------------------------------------- timings & sous-titres

def scene_duration(sc: dict, first: bool) -> float:
    n = len(words(sc.get("voiceover", "")))
    d = n / WORDS_PER_SEC + (0.25 if first else SCENE_PAUSE)
    return round(max(d, 2.0) * 30) / 30


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


def build_cues(scenes: list[dict]) -> list[tuple[float, float, str]]:
    cues, t = [], 0.0
    for sc in scenes:
        chunks = split_cues(sc.get("voiceover", ""))
        start, end = t + 0.05, t + sc["duration"] - 0.12
        total = sum(len(c) for c in chunks) or 1
        cur = start
        for c in chunks:
            span = (end - start) * len(c) / total
            text = two_lines(c).replace(" ?", " ?").replace(" !", " !").replace(" :", " :")
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


# ---------------------------------------------------------------- fichiers texte

def script_text(post: dict) -> str:
    lines = [f"TIO CLEM — {post['title']}", f"Jour {post['day']} · {post['category']} · {post['format']}", ""]
    if post["format"] == "video":
        lines += ["VOIX OFF (phrases courtes, pauses sur la ponctuation)", ""]
        t = 0.0
        for sc in post["scenes"]:
            lines.append(f"[{t:04.1f}s → {t + sc['duration']:04.1f}s] {sc['id'].upper()} · {sc['role']}")
            lines.append(sc["voiceover"])
            lines.append("")
            t += sc["duration"]
    else:
        for sl in post["slides"]:
            lines.append(f"SLIDE {sl['id'][-2:]} · {sl['role']}")
            lines.append(sl["title"])
            if sl.get("body"):
                lines.append(sl["body"])
            lines.append("")
    lines += ["HOOKS ÉTUDIÉS"] + [f"{'→' if i == post['hook_selected'] else ' '} {h}" for i, h in enumerate(post["hooks"])]
    lines += ["", f"Pourquoi ce hook : {post.get('hook_reason', '')}"]
    return "\n".join(lines) + "\n"


def caption_text(post: dict) -> str:
    return post["caption"].strip() + "\n\n" + " ".join(post["hashtags"]) + "\n"


def readme_text(post: dict, duration: float | None, status: str, sources: list[dict], qa: dict) -> str:
    dur = f"{duration:.1f} s" if duration else f"{len(post.get('slides', []))} slides"
    src = "\n".join(f"  - {s['editeur']} — {s['titre']}\n    {s['url']}" for s in sources)
    warn = [f"  - {k} : {v['detail']}" for k, v in qa["checks"].items() if v["level"] != "ok"]
    checks = "\n".join(f"  - {c}" for c in post.get("human_checks", []))
    hook = post["hooks"][post["hook_selected"]]
    return f"""TITRE : {post['title']}

CATÉGORIE : {post['category']}

FORMAT : {post['format']} (1080x1920{', 30 fps, H.264 + AAC' if post['format'] == 'video' else ''})

DURÉE : {dur}

HOOK : {hook}

DESCRIPTION :
{post['caption'].strip()}

HASHTAGS : {' '.join(post['hashtags'])}

CTA : {post['cta']}

QUESTION À POSER : {post['question']}

SOURCES :
{src}

À VÉRIFIER PAR UN HUMAIN AVANT PUBLICATION :
{checks or '  (rien de particulier)'}

POINTS SIGNALÉS PAR LE CONTRÔLE QUALITÉ :
{chr(10).join(warn) or '  (aucun)'}

STATUT : {status}
"""


# ---------------------------------------------------------------- contrôle qualité

def check(level_ok: bool, detail: str, level_ko: str = "fail") -> dict:
    return {"level": "ok" if level_ok else level_ko, "detail": detail}


def spell_warnings(post: dict, research: dict) -> list[str]:
    try:
        from spellchecker import SpellChecker
    except ImportError:
        return []
    sp = SpellChecker(language="fr")
    allowed = set()
    for s in post.get("seo", {}).get("expressions", []) + post.get("seo", {}).get("secondary", []):
        allowed |= {fold(w) for w in re.findall(r"\w+", s)}
    allowed |= {fold(w) for w in re.findall(r"\w+", json.dumps(research, ensure_ascii=False))}
    lexique = ROOT / "assets" / "lexique.txt"
    if lexique.exists():
        allowed |= {fold(l.strip()) for l in lexique.read_text(encoding="utf-8").splitlines()
                    if l.strip() and not l.startswith("#")}
    texts = [post["caption"], post["cta"], post["question"]]
    texts += [sc.get("voiceover", "") for sc in post.get("scenes", [])]
    texts += [sc.get("on_screen", {}).get("subtitle", "") for sc in post.get("scenes", [])]
    texts += [f"{s.get('title', '')} {s.get('body', '')}" for s in post.get("slides", [])]
    found = set()
    for t in texts:
        for w in re.findall(r"[A-Za-zÀ-ÿ]+", t):
            if w[0].isupper() or len(w) < 3 or fold(w) in allowed:
                continue
            if sp.unknown([w.lower()]):
                found.add(w)
    return sorted(found)


def run_qa(post: dict, research: dict, outdir: Path, render_boxes: dict | None = None) -> dict:
    c = {}
    fmt = post["format"]
    fact_index = {f["id"]: f for f in research.get("faits", [])}
    source_ids = {s["id"] for s in research.get("sources", [])}
    units = post.get("scenes") if fmt == "video" else post.get("slides")

    # exactitude
    problems = []
    for u in units:
        if u.get("role") in ("info", "surprise") and not u.get("facts"):
            problems.append(f"{u['id']} : aucune référence de fait")
        for fid in u.get("facts", []):
            f = fact_index.get(fid)
            if not f:
                problems.append(f"{u['id']} : fait {fid} absent de la recherche")
                continue
            if f.get("confiance") == "basse":
                problems.append(f"{u['id']} : fait {fid} de confiance basse")
            text = fold(u.get("voiceover", "") + " " + u.get("body", ""))
            if f.get("statut") in ("HYPOTHÈSE", "LÉGENDE", "INTERPRÉTATION") and not any(h in text for h in map(fold, HEDGES)):
                problems.append(f"{u['id']} : {fid} est une {f['statut'].lower()} présentée sans précaution")
    c["exactitude"] = check(not problems, "; ".join(problems) or "chaque info renvoie à un fait sourcé")

    # sources
    bad = [f["id"] for f in research.get("faits", []) if not f.get("sources") or not set(f["sources"]) <= source_ids]
    no_url = [s["id"] for s in research.get("sources", []) if not str(s.get("url", "")).startswith("http")]
    ok = len(source_ids) >= 2 and not bad and not no_url and research.get("faits")
    c["sources"] = check(ok, f"{len(source_ids)} sources, {len(fact_index)} faits"
                         + (f" ; faits sans source valide : {bad}" if bad else "")
                         + (f" ; sources sans URL : {no_url}" if no_url else ""))

    # orthographe / grammaire (heuristiques)
    unknown = spell_warnings(post, research)
    c["orthographe"] = check(not unknown, "mots inconnus du dictionnaire : " + ", ".join(unknown) if unknown
                             else "aucun mot inconnu", "warn")
    all_text = " ".join([post["caption"]] + [u.get("voiceover", "") + " " + u.get("body", "") for u in units])
    gram = []
    if re.search(r"\b(\w+) \1\b", all_text, re.IGNORECASE):
        gram.append("mot répété deux fois de suite")
    if re.search(r"\S[?!;:]", re.sub(r"https?://\S+", "", all_text)):
        gram.append("espace manquante avant ? ! ; :")
    if re.search(r"(^|[.?!] )[a-zà-ÿ]", all_text):
        gram.append("phrase sans majuscule initiale")
    c["grammaire"] = check(not gram, "; ".join(gram) or "ponctuation et majuscules correctes", "warn")

    # hook
    hooks = post.get("hooks", [])
    starts = {fold(" ".join(words(h)[:2])) for h in hooks}
    hook_problems = []
    if len(hooks) != 5:
        hook_problems.append(f"{len(hooks)} hooks au lieu de 5")
    if len(starts) < len(hooks):
        hook_problems.append("plusieurs hooks commencent pareil")
    if fmt == "video":
        first = post["scenes"][0]
        if first.get("role") != "hook":
            hook_problems.append("la scène 1 n'est pas le hook")
        if first["duration"] > HOOK_MAX:
            hook_problems.append(f"hook trop long ({first['duration']:.1f} s > {HOOK_MAX} s)")
        if fold(first["voiceover"]) != fold(hooks[post["hook_selected"]]):
            hook_problems.append("la voix off de la scène 1 ne reprend pas le hook choisi")
        if re.match(r"(bonjour|salut|aujourd'hui)", fold(first["voiceover"])):
            hook_problems.append("la vidéo commence par une formule d'introduction")
    elif post["slides"][0].get("role") != "hook":
        hook_problems.append("la slide 1 n'est pas le hook")
    c["hook"] = check(not hook_problems, "; ".join(hook_problems) or hooks[post["hook_selected"]])

    # rythme
    if fmt == "video":
        rates = []
        for sc in post["scenes"]:
            r = len(words(sc["voiceover"])) / sc["duration"]
            if not 1.6 <= r <= 3.4 or sc["duration"] > 8:
                rates.append(f"{sc['id']} ({r:.1f} mots/s, {sc['duration']:.1f} s)")
        c["rythme"] = check(not rates, "scènes hors rythme : " + ", ".join(rates) if rates
                            else f"{len(post['scenes'])} scènes, aucune au-delà de 8 s", "warn")
    else:
        long_ = [s["id"] for s in post["slides"] if len(s.get("body", "")) > 170 or len(words(s["title"])) > 9]
        c["rythme"] = check(not long_, "slides trop chargées : " + ", ".join(long_) if long_
                            else "une idée courte par slide", "warn")

    # durée / nombre de slides
    if fmt == "video":
        info = __import__("render").video_info(outdir / "video.mp4")
        d = info["duration"]
        c["duree"] = check(VIDEO_MIN <= d <= VIDEO_MAX + 0.2, f"{d:.1f} s (cible {VIDEO_MIN:.0f}–{VIDEO_MAX:.0f} s)")
        ok = (info.get("width"), info.get("height")) == (1080, 1920) and round(info.get("fps", 0)) == 30 \
            and info.get("vcodec") == "h264" and info.get("acodec") == "aac"
        c["format_1080x1920"] = check(ok, f"{info.get('width')}x{info.get('height')}, {info.get('fps')} fps, "
                                          f"{info.get('vcodec')} / {info.get('acodec')}")
    else:
        n = len(post["slides"])
        c["duree"] = check(SLIDES_MIN <= n <= SLIDES_MAX, f"{n} slides (cible {SLIDES_MIN}–{SLIDES_MAX})")
        from PIL import Image
        sizes = {Image.open(p).size for p in sorted((outdir / "slides").glob("*.jpg"))}
        c["format_1080x1920"] = check(sizes == {(1080, 1920)}, f"tailles des slides : {sizes}")

    # cohérence visuelle + zones sûres
    from render import PALETTES, SAFE
    pals = [u.get("visual", u).get("palette", "rojo") for u in units]
    unknown_pal = [p for p in pals if p not in PALETTES]
    outside = []
    for name, boxes in (render_boxes or {}).items():
        for kind, (x0, y0, x1, y1) in boxes:
            if x0 < SAFE[0] or x1 > SAFE[2] or y0 < SAFE[1] or y1 > SAFE[3]:
                outside.append(f"{name}.{kind}")
    same_run = any(pals[i] == pals[i + 1] for i in range(len(pals) - 1))
    vis = []
    if unknown_pal:
        vis.append(f"palettes hors charte : {unknown_pal}")
    if outside:
        vis.append(f"texte hors zone sûre : {outside}")
    c["coherence_visuelle"] = check(not vis, "; ".join(vis) or
                                    f"charte Tio Clem, {len(set(pals))} palettes"
                                    + (" (deux scènes consécutives de même couleur)" if same_run else ""))
    cover = outdir / "cover.jpg"
    if cover.exists():
        from PIL import Image
        csize = Image.open(cover).size
        cw = len(words(post["cover"]["text"]))
        c["cover"] = check(csize == (1080, 1920) and 3 <= cw <= 7, f"{csize[0]}x{csize[1]}, {cw} mots")
    else:
        c["cover"] = check(False, "cover.jpg manquante")

    # sous-titres
    if fmt == "video":
        try:
            cues = parse_srt(outdir / "subtitles.srt")
            errs = []
            for i, (a, b, txt) in enumerate(cues):
                if b <= a:
                    errs.append(f"cue {i + 1} de durée nulle")
                if i and a < cues[i - 1][1] - 0.001:
                    errs.append(f"cue {i + 1} chevauche la précédente")
                if any(len(l) > 30 for l in txt.splitlines()) or len(txt.splitlines()) > 2:
                    errs.append(f"cue {i + 1} trop longue")
            if cues and cues[-1][1] > d + 0.05:
                errs.append("sous-titres au-delà de la fin")
            c["sous_titres"] = check(not errs, "; ".join(errs) or f"{len(cues)} sous-titres, incrustés en zone sûre")
        except (OSError, ValueError) as e:
            c["sous_titres"] = check(False, str(e))
    else:
        c["sous_titres"] = check(True, "sans objet (carrousel)")

    # CTA
    last = units[-1]
    cta_ok = last.get("role") == "cta" and "?" in (last.get("voiceover", "") + last.get("title", "") + last.get("body", ""))
    winner = [w for w in WINNER_WORDS if w in fold(post["caption"] + post["cta"])]
    if post["category"] in ("interaction", "quiz") and winner:
        cta_ok = False
    c["cta"] = check(cta_ok and "?" in post["question"], post["cta"] + (f" — gagnant désigné : {winner}" if winner else ""))

    # description + SEO
    seo = post.get("seo", {})
    main = fold(seo.get("main", ""))
    script_all = fold(" ".join(u.get("voiceover", "") + " " + u.get("title", "") + " " + u.get("body", "") for u in units))
    screen = fold(" ".join(u.get("on_screen", {}).get("title", "") + " " + u.get("on_screen", {}).get("subtitle", "")
                           + u.get("title", "") for u in units))
    cap = fold(post["caption"])
    desc = []
    if not main:
        desc.append("mot-clé principal non défini")
    else:
        if main not in cap:
            desc.append("mot-clé principal absent de la description")
        if main not in script_all:
            desc.append("mot-clé principal absent du script")
        if fold(seo.get("onscreen", seo.get("main", ""))) not in screen:
            desc.append("mot-clé absent du texte à l'écran")
        if cap.count(main) > 2:
            desc.append("mot-clé répété plus de 2 fois (bourrage)")
    if "#" in post["caption"]:
        desc.append("hashtags dans la description (ils sont ajoutés à part)")
    if len(caption_text(post)) > 2200:
        desc.append("description trop longue")
    if "?" not in post["caption"]:
        desc.append("pas de question dans la description")
    c["description"] = check(not desc, "; ".join(desc) or f"{len(post['caption'])} caractères, mot-clé « {seo.get('main')} »")

    # hashtags
    tags = post.get("hashtags", [])
    tag_err = []
    if not HASHTAGS_MIN <= len(tags) <= HASHTAGS_MAX:
        tag_err.append(f"{len(tags)} hashtags")
    if any(not re.fullmatch(r"#[A-Za-z0-9_]+", t) for t in tags):
        tag_err.append("format invalide")
    if not any("perou" in t.lower() or "peru" in t.lower() for t in tags):
        tag_err.append("aucun hashtag Pérou")
    c["hashtags"] = check(not tag_err, "; ".join(tag_err) or " ".join(tags))

    # répétitions (dans le post et avec l'historique)
    rep = []
    grams = {}
    for u in units:
        ws = [fold(w) for w in words(u.get("voiceover", "") + " " + u.get("body", ""))]
        for i in range(len(ws) - 3):
            g = " ".join(ws[i:i + 4])
            if g in grams and grams[g] != u["id"]:
                rep.append(f"« {g} » ({grams[g]} et {u['id']})")
            grams.setdefault(g, u["id"])
    for p in history()["publications"]:
        if p["day"] == post["day"]:
            continue
        if fold(p["subject"]) == fold(post["title"]):
            rep.append(f"sujet identique au jour {p['day']}")
        if fold(p.get("hook", "")) == fold(post["hooks"][post["hook_selected"]]):
            rep.append(f"hook identique au jour {p['day']}")
        if p.get("angle") and fold(p["angle"]) == fold(post.get("angle", "")):
            rep.append(f"angle identique au jour {p['day']}")
    c["absence_de_repetition"] = check(not rep, "; ".join(rep) or "aucune répétition détectée")

    # banque d'idées : rattachement, rotation des catégories, thème + angle déjà utilisés
    import bank
    missing = [k for k in ("topic_id", "theme", "type_angle", "bank_category") if not post.get(k)]
    bank_pb = [f"champs manquants : {', '.join(missing)}"] if missing else []
    if post.get("topic_id") and not bank.topic_by_id(post["topic_id"]):
        bank_pb.append(f"idée {post['topic_id']} absente de content/topics.json")
    if post.get("bank_category") and post["bank_category"] not in bank.TARGET_SHARE:
        bank_pb.append(f"catégorie inconnue : {post['bank_category']}")
    bank_pb += bank.repetition_problems(post, history()["publications"])
    c["rotation_et_banque"] = check(not bank_pb, "; ".join(bank_pb) or
                                    f"idée {post.get('topic_id')} · {post.get('bank_category')} · angle {post.get('type_angle')}")

    fails = [k for k, v in c.items() if v["level"] == "fail"]
    return {"status": READY if not fails else REVIEW, "fails": fails,
            "warnings": [k for k, v in c.items() if v["level"] == "warn"], "checks": c,
            "checked_at": dt.datetime.now().isoformat(timespec="seconds")}


# ---------------------------------------------------------------- construction

def find_voice(day: int, explicit: str | None) -> Path | None:
    if explicit:
        return Path(explicit)
    for ext in ("m4a", "mp3", "wav", "aac"):
        p = CONTENT / "voice" / f"day-{day:02d}.{ext}"
        if p.exists():
            return p
    return None


def media_for(day: int, unit_id: str) -> Path | None:
    for ext in ("jpg", "jpeg", "png", "webp"):
        p = CONTENT / "media" / f"day-{day:02d}" / f"{unit_id}.{ext}"
        if p.exists():
            return p
    return None


def build(day: int, voice_arg: str | None = None) -> dict:
    import render

    path = post_path(day)
    if not path.exists():
        sys.exit(f"{path.relative_to(ROOT)} n'existe pas : lance d'abord la recherche et l'écriture (/create-day {day}).")
    post = load(path)
    research = load(ROOT / post["research"])
    log = autofix(post)
    outdir = out_dir(post)
    outdir.mkdir(parents=True, exist_ok=True)
    boxes = {}

    # cover
    cv = post["cover"]
    bg, fg, b = render.render_card({"title": cv["text"], "badge_emoji": cv.get("emoji"), "emoji": cv.get("illustration", "🇵🇪"),
                                    "palette": cv.get("palette", "rojo"), "big": True}, media_for(day, "cover"))
    render.flatten(bg, fg).save(outdir / "cover.jpg", quality=92)
    boxes["cover"] = b

    duration = None
    if post["format"] == "video":
        for i, sc in enumerate(post["scenes"]):
            sc["duration"] = scene_duration(sc, i == 0)
        voice = find_voice(day, voice_arg)
        if voice and voice.exists():
            vlen = render.probe_duration(voice)
            k = vlen / sum(s["duration"] for s in post["scenes"])
            for sc in post["scenes"]:
                sc["duration"] = round(sc["duration"] * k * 30) / 30
            log.append(f"voix off {voice.name} ({vlen:.1f} s) : scènes recalées")
        frames = []
        for sc in post["scenes"]:
            os_ = sc["on_screen"]
            card = {"title": os_["title"], "subtitle": os_.get("subtitle"), "badge_emoji": None,
                    "emoji": sc["visual"].get("emoji") or os_.get("emoji"), "palette": sc["visual"].get("palette", "rojo"),
                    "number": sc.get("number")}
            if sc["role"] == "hook":
                card["badge_emoji"] = os_.get("emoji")
            bg, fg, b = render.render_card(card, media_for(day, sc["id"]))
            boxes[sc["id"]] = b
            frames.append({"bg": bg, "fg": fg, "duration": sc["duration"], "animation": sc.get("animation", "")})
        cues = build_cues(post["scenes"])
        write_srt(cues, outdir / "subtitles.srt")
        render.render_video(frames, cues, outdir / "video.mp4", voice if voice and voice.exists() else None)
        duration = sum(s["duration"] for s in post["scenes"])
        scenes_out = []
        t = 0.0
        for sc in post["scenes"]:
            scenes_out.append({
                "scene": sc["id"].upper().replace("SCENE", "SCENE "), "role": sc["role"],
                "debut": round(t, 2), "duree": round(sc["duration"], 2),
                "visuel": sc["visual"]["need"], "description": sc["visual"]["description"],
                "texte_ecran": sc["on_screen"]["title"] + (f" {sc['on_screen']['emoji']}" if sc["role"] == "hook" else ""),
                "sous_texte_ecran": sc["on_screen"].get("subtitle", ""),
                "voix_off": sc["voiceover"], "animation": sc.get("animation", ""), "faits": sc.get("facts", []),
                "media_personnel": str(media_for(day, sc["id"]) or ""),
            })
            t += sc["duration"]
        save(outdir / "scenes.json", {"format": "1080x1920 · 9:16 · 30 fps · H.264 + AAC", "duree_totale": round(duration, 2),
                                      "scenes": scenes_out})
    else:
        sdir = outdir / "slides"
        sdir.mkdir(exist_ok=True)
        for old in sdir.glob("*.jpg"):
            old.unlink()
        for i, sl in enumerate(post["slides"], 1):
            card = {"title": sl["title"], "body": sl.get("body"), "emoji": sl.get("emoji", "🇵🇪"),
                    "palette": sl.get("palette", "rojo"), "number": sl.get("number"),
                    "subtitle": sl.get("subtitle")}
            bg, fg, b = render.render_card(card, media_for(day, sl["id"]))
            render.flatten(bg, fg).save(sdir / f"{i:02d}.jpg", quality=92)
            boxes[sl["id"]] = b
        save(outdir / "scenes.json", {"format": "carrousel 1080x1920", "slides": post["slides"]})

    used = {fid for u in post.get("scenes", post.get("slides", [])) for fid in u.get("facts", [])}
    used_src = {s for f in research["faits"] if f["id"] in used for s in f["sources"]}
    sources = [s for s in research["sources"] if s["id"] in used_src]
    save(outdir / "sources.json", {"sujet": research["sujet"], "sources_utilisees": sources,
                                   "faits_utilises": [f for f in research["faits"] if f["id"] in used],
                                   "informations_ecartees": research.get("informations_ecartees", []),
                                   "recherche_complete": post["research"]})
    (outdir / "script.txt").write_text(script_text(post), encoding="utf-8")
    (outdir / "caption.txt").write_text(caption_text(post), encoding="utf-8")
    (outdir / "hashtags.txt").write_text(" ".join(post["hashtags"]) + "\n", encoding="utf-8")

    qa = run_qa(post, research, outdir, boxes)
    qa["autofix"] = log
    save(outdir / "qa.json", qa)
    (outdir / "README.txt").write_text(readme_text(post, duration, qa["status"], sources, qa), encoding="utf-8")
    save(path, post)  # conserve corrections et durées calculées
    record(post, qa["status"], outdir)
    return qa


def record(post: dict, status: str, outdir: Path) -> None:
    import bank
    h = history()
    prev = next((p for p in h["publications"] if p["day"] == post["day"]), {})
    if prev.get("status") == "PUBLISHED" and status == READY:
        status = "PUBLISHED"
    entry = {
        "day": post["day"], "date": post["date"], "subject": post["title"], "category": post["category"],
        "bank_category": post.get("bank_category"), "topic_id": post.get("topic_id"),
        "theme": post.get("theme"), "type_angle": post.get("type_angle"),
        "format": post["format"], "angle": post.get("angle", ""), "hook": post["hooks"][post["hook_selected"]],
        "keywords": [post["seo"]["main"], *post["seo"].get("secondary", [])], "status": status,
        "output": str(outdir.relative_to(ROOT)), "updated_at": dt.datetime.now().isoformat(timespec="seconds"),
    }
    for key in ("performance", "published_at"):
        if key in prev:
            entry[key] = prev[key]
    bank.mark_used(post.get("topic_id"), post["day"], post["date"], post)
    h["publications"] = [p for p in h["publications"] if p["day"] != post["day"]] + [entry]
    h["publications"].sort(key=lambda p: p["day"])
    save(PUBLISHED, h)


# ---------------------------------------------------------------- commandes

def cmd_calendar(_):
    done = {p["day"]: p["status"] for p in history()["publications"]}
    for d in calendar()["days"]:
        st = done.get(d["day"]) or ("SCRIPT_PRÊT" if post_path(d["day"]).exists() else "À FAIRE")
        print(f"J{d['day']:02d}  {d['date']}  {d['format']:<9} {d['category']:<12} {st:<17} {d.get('bank_category', ''):<12} {d['subject']}")


def next_day() -> int | None:
    done = {p["day"] for p in history()["publications"] if p["status"] in (READY, "PUBLISHED")}
    for d in calendar()["days"]:
        if d["day"] not in done:
            return d["day"]
    return None


def cmd_next(_):
    n = next_day()
    if n is not None:
        entry = day_entry(n)
        topic = __import__("bank").topic_by_id(entry.get("topic_id") or "")
        print(json.dumps({**entry, "source": "calendrier", "idee": topic}, ensure_ascii=False, indent=1))
        return
    # calendrier terminé : la banque d'idées prend le relais
    import bank
    pubs = history()["publications"]
    day = max(p["day"] for p in pubs) + 1
    date = (dt.date.fromisoformat(max(p["date"] for p in pubs)) + dt.timedelta(days=1)).isoformat()
    best = bank.pick(1)
    if not best:
        sys.exit("Aucune idée disponible : lance /idea pour régénérer la banque.")
    print(json.dumps({"day": day, "date": date, "source": "banque", "idee": best[0]}, ensure_ascii=False, indent=1))


def show_topic(t: dict) -> str:
    flag = " 🎥 tournage" if t.get("tournage_requis") else ""
    why = f"  ({', '.join(t['raisons'])})" if t.get("raisons") else ""
    return (f"{t['id']}  {t['selection']:>5}  {t['categorie']:<11} {t['format']:<9} {t['type_angle']:<12} "
            f"{t['sujet']} — {t['angle']}{flag}{why}")


def cmd_pick(a):
    import bank
    for t in bank.pick(a.n, a.format, a.category, a.filming):
        print(show_topic(t))


def cmd_bank(_):
    import bank
    r = bank.report()
    print(f"{r['idees']} idées, {r['restantes']} jamais utilisées")
    print(f"{'catégorie':<12} {'banque':>6} {'restantes':>9} {'publiées':>8} {'part':>6} {'cible':>6}")
    for c, v in r["categories"].items():
        print(f"{c:<12} {v['banque']:>6} {v['restantes']:>9} {v['publiees']:>8} {v['part']:>6.0%} {v['cible']:>6.0%}")
    print("sous-représentées :", ", ".join(r["sous_representees"]) or "aucune")
    print("angles utilisés   :", r["angles_utilises"] or "aucun")
    print("formats utilisés  :", r["formats_utilises"] or "aucun")
    print("intentions (10 derniers) :", r["intentions_10_dernieres"] or "aucune")
    if r["a_regenerer"]:
        print("→ moins de 40 idées neuves : lance /idea pour en générer.")
    for pb in r["problemes"]:
        print("PROBLÈME :", pb)
    if r["problemes"]:
        sys.exit(1)


def cmd_combine(a):
    import bank
    ideas = bank.combine(a.n)
    if a.json:
        print(json.dumps(ideas, ensure_ascii=False, indent=1))
        return
    for o in ideas:
        flag = " 🎥" if o["tournage_requis"] else ""
        print(f"{o['selection']:>5}  {o['categorie']:<11} {o['type_angle']:<12} {o['format']:<9} "
              f"{o['public']:<28} {o['emotion']:<18} {o['titre_brouillon']}{flag}")


def cmd_stats(a):
    h = history()
    p = next((p for p in h["publications"] if p["day"] == a.day), None)
    if not p:
        sys.exit(f"Jour {a.day} absent de published.json.")
    perf = p.setdefault("performance", {})
    for k in ("vues", "likes", "commentaires", "partages", "enregistrements"):
        v = getattr(a, k)
        if v is not None:
            perf[k] = v
    if a.retention is not None:
        perf["retention_moyenne_pct"] = a.retention
    perf["releve_le"] = dt.date.today().isoformat()
    p["status"] = "PUBLISHED"
    p.setdefault("published_at", a.published or p["date"])
    save(PUBLISHED, h)
    e = __import__("bank").engagement(perf)
    print(f"Jour {a.day} : statistiques enregistrées" + (f", engagement pondéré {e:.1%}" if e is not None else ""))


def print_qa(day, qa):
    print(f"\nJour {day} → {qa['status']}")
    for k, v in qa["checks"].items():
        mark = {"ok": "[x]", "warn": "[~]", "fail": "[ ]"}[v["level"]]
        print(f"  {mark} {k:<22} {v['detail']}")
    for line in qa.get("autofix", []):
        print(f"  corrigé automatiquement : {line}")


def cmd_build(a):
    qa = build(a.day, a.voice)
    print_qa(a.day, qa)
    if qa["status"] != READY:
        sys.exit(1)


def cmd_review(a):
    days = [p["day"] for p in history()["publications"]] if a.day in (None, "all") else [int(a.day)]
    worst = 0
    for day in days:
        post = load(post_path(day))
        outdir = out_dir(post)
        qa = run_qa(post, load(ROOT / post["research"]), outdir)
        prev = load(outdir / "qa.json") if (outdir / "qa.json").exists() else {}
        # les bbox ne sont connues qu'au rendu : on garde ce verdict-là
        if prev.get("checks", {}).get("coherence_visuelle"):
            qa["checks"]["coherence_visuelle"] = prev["checks"]["coherence_visuelle"]
        save(outdir / "qa.json", qa)
        record(post, qa["status"], outdir)
        print_qa(day, qa)
        worst = max(worst, qa["status"] != READY)
    sys.exit(worst)


def cmd_export(_):
    ready = [p for p in history()["publications"] if p["status"] == READY]
    if not ready:
        sys.exit("Aucune publication READY_TO_PUBLISH.")
    EXPORT.mkdir(exist_ok=True)
    stamp = dt.date.today().isoformat()
    zpath = EXPORT / f"tioclem-pret-a-publier-{stamp}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for p in ready:
            folder = ROOT / p["output"]
            for f in sorted(folder.rglob("*")):
                if f.is_file():
                    z.write(f, f.relative_to(OUTPUT))
    lines = [f"J{p['day']:02d} {p['date']} {p['format']:<9} {p['subject']}  →  {p['output']}" for p in ready]
    (EXPORT / "A-PUBLIER.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\n{zpath.relative_to(ROOT.parent)}")


def main():
    ap = argparse.ArgumentParser(description="Tio Clem — Content Factory")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("calendar").set_defaults(fn=cmd_calendar)
    sub.add_parser("next").set_defaults(fn=cmd_next)
    b = sub.add_parser("build")
    b.add_argument("day", type=int)
    b.add_argument("--voice", help="fichier audio de voix off (sinon content/voice/day-NN.*)")
    b.set_defaults(fn=cmd_build)
    r = sub.add_parser("review")
    r.add_argument("day", nargs="?")
    r.set_defaults(fn=cmd_review)
    sub.add_parser("export").set_defaults(fn=cmd_export)
    pk = sub.add_parser("pick", help="meilleures idées à produire maintenant")
    pk.add_argument("n", type=int, nargs="?", default=5)
    pk.add_argument("--format", choices=["video", "carrousel", "quiz"])
    pk.add_argument("--category")
    pk.add_argument("--filming", action="store_true", help="inclure sans pénalité les idées à tourner")
    pk.set_defaults(fn=cmd_pick)
    sub.add_parser("bank", help="état de la banque d'idées").set_defaults(fn=cmd_bank)
    cb = sub.add_parser("combine", help="nouvelles combinaisons sujet + angle")
    cb.add_argument("n", type=int, nargs="?", default=20)
    cb.add_argument("--json", action="store_true")
    cb.set_defaults(fn=cmd_combine)
    st = sub.add_parser("stats", help="enregistrer les statistiques TikTok d'une publication")
    st.add_argument("day", type=int)
    for k in ("vues", "likes", "commentaires", "partages", "enregistrements"):
        st.add_argument(f"--{k}", type=int)
    st.add_argument("--retention", type=float, help="rétention moyenne en %%")
    st.add_argument("--published", help="date de publication AAAA-MM-JJ")
    st.set_defaults(fn=cmd_stats)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
