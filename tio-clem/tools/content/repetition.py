"""Détection de répétition entre publications.

Deux publications peuvent parler du même sujet seulement si l'approche est
réellement différente. Chaque nouvelle publication est comparée aux publications
déjà produites sur 8 dimensions : sujet, angle, informations, format, hook,
visuels, CTA, formulation. Chaque dimension reçoit un niveau ok / warn / fail.
"""
from __future__ import annotations

import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS = ROOT / "content" / "posts"
PUBLISHED = ROOT / "content" / "published.json"
DIMENSIONS = ("sujet", "angle", "informations", "format", "hook", "visuels", "cta", "formulation")
_RULES = json.loads((ROOT / "config" / "content-pillars.json").read_text(encoding="utf-8"))["rules"]
THEME_COOLDOWN = _RULES["theme_cooldown_posts"]

STOP = set("""le la les un une des du de d l et ou a au aux en dans sur pour par avec sans ce cet cette ces
son sa ses ton ta tes mon ma mes leur leurs qui que quoi dont est sont c s n ne pas plus tu te toi il elle
on nous vous ils elles y se qu j je me moi lui ca ça tres très bien tout tous toute toutes""".split())


def fold(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", (text or "").lower()) if unicodedata.category(c) != "Mn")


def tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"\w+", fold(text)) if w not in STOP and len(w) > 2}


def similarity(a: str, b: str) -> float:
    """0 à 1 : le plus haut entre le recouvrement de mots utiles et la ressemblance des phrases."""
    if not a or not b:
        return 0.0
    ta, tb = tokens(a), tokens(b)
    jac = len(ta & tb) / len(ta | tb) if ta | tb else 0.0
    return max(jac, SequenceMatcher(None, fold(a), fold(b)).ratio())


def shingles(text: str, n: int = 4) -> set[str]:
    ws = re.findall(r"\w+", fold(text))
    return {" ".join(ws[i:i + n]) for i in range(len(ws) - n + 1)}


# ---------------------------------------------------------------- lecture des posts

def units(post: dict) -> list[dict]:
    return post.get("scenes") or post.get("slides") or []


def script_text(post: dict) -> str:
    return " ".join(f"{u.get('voiceover', '')} {u.get('title', '')} {u.get('body', '')}" for u in units(post))


def hook(post: dict) -> str:
    return post["hooks"][post.get("hook_selected", 0)] if post.get("hooks") else ""


def hook_type(post: dict) -> str | None:
    types = post.get("hook_types") or []
    i = post.get("hook_selected", 0)
    return types[i] if i < len(types) else None


def visuals(post: dict) -> set[str]:
    out = set()
    for u in units(post):
        v = u.get("visual", {})
        out |= tokens(v.get("need", "")) if v else set()
        out.add(v.get("emoji") or u.get("emoji") or "")
    return out - {""}


def facts_text(post: dict) -> list[str]:
    try:
        research = json.loads((ROOT / post["research"]).read_text(encoding="utf-8"))
    except (KeyError, OSError):
        return []
    used = {f for u in units(post) for f in u.get("facts", [])}
    return [f["fait"] for f in research.get("faits", []) if f["id"] in used]


def produced_posts(exclude_day: int | None = None) -> list[dict]:
    """Posts déjà produits (présents dans published.json), du plus ancien au plus récent."""
    pubs = json.loads(PUBLISHED.read_text(encoding="utf-8"))["publications"] if PUBLISHED.exists() else []
    out = []
    for p in sorted(pubs, key=lambda p: (p["date"], p["day"])):
        f = POSTS / f"day-{p['day']:02d}.json"
        if p["day"] != exclude_day and f.exists():
            out.append(json.loads(f.read_text(encoding="utf-8")))
    return out


# ---------------------------------------------------------------- analyse

def _add(findings, dim, level, detail, day=None):
    findings.append({"dimension": dim, "level": level, "detail": detail, "day": day})


def check_candidate(title: str, theme: str | None, angle_type: str | None, fmt: str | None,
                    history: list[dict] | None = None, idea_id: str | None = None,
                    day: int | None = None, date: str | None = None) -> list[dict]:
    """Avant d'écrire : le sujet, l'angle et le format sont-ils assez nouveaux ?"""
    history = produced_posts(day) if history is None else history
    if date:
        history = [p for p in history if p.get("date", "") < date]
    findings = []
    recent = history[-THEME_COOLDOWN:]
    for p in history:
        d = p.get("day")
        same_theme = theme and p.get("theme") == theme
        if idea_id and p.get("idea_id") == idea_id:
            _add(findings, "sujet", "fail", f"même idée ({idea_id}) déjà produite", d)
        s = similarity(title, p.get("title", ""))
        if s >= 0.7:
            _add(findings, "sujet", "fail" if same_theme else "warn",
                 f"titre très proche de « {p.get('title')} » ({s:.0%})", d)
        if same_theme:
            if p in recent:
                _add(findings, "sujet", "fail", f"thème « {theme} » traité dans les {THEME_COOLDOWN} dernières publications", d)
            else:
                _add(findings, "sujet", "ok", f"thème « {theme} » déjà traité : l'approche doit changer", d)
            if angle_type and p.get("type_angle") == angle_type:
                _add(findings, "angle", "fail", f"même thème et même type d'angle « {angle_type} »", d)
            if fmt and p.get("format") == fmt and p in history[-10:]:
                _add(findings, "format", "warn", f"même thème et même format ({fmt}) récemment", d)
    return findings


def check_post(post: dict, history: list[dict] | None = None) -> dict:
    """Compare un post complet aux publications déjà produites, sur les 8 dimensions."""
    history = produced_posts(post.get("day")) if history is None else history
    history = [p for p in history if (p.get("date", ""), p.get("day", 0)) < (post.get("date", ""), post.get("day", 0))]
    findings = check_candidate(post.get("title", ""), post.get("theme"), post.get("type_angle"), post.get("format"),
                               history, post.get("idea_id"))
    my_facts, my_script, my_hook, my_vis = facts_text(post), shingles(script_text(post)), hook(post), visuals(post)
    last = history[-1] if history else None
    for p in history:
        d = p.get("day")
        # informations : les faits utilisés sont-ils déjà passés ?
        theirs = facts_text(p)
        if my_facts and theirs:
            dup = [f for f in my_facts if max(similarity(f, t) for t in theirs) >= 0.6]
            ratio = len(dup) / len(my_facts)
            if ratio >= 0.5:
                _add(findings, "informations", "fail", f"{len(dup)}/{len(my_facts)} informations déjà données", d)
            elif ratio >= 0.3:
                _add(findings, "informations", "warn", f"{len(dup)}/{len(my_facts)} informations déjà données", d)
        # hook
        s = similarity(my_hook, hook(p))
        if s >= 0.7:
            _add(findings, "hook", "fail", f"hook presque identique à « {hook(p)} » ({s:.0%})", d)
        elif s >= 0.5:
            _add(findings, "hook", "warn", f"hook proche de « {hook(p)} » ({s:.0%})", d)
        # visuels
        cs = similarity(post.get("cover", {}).get("text", ""), p.get("cover", {}).get("text", ""))
        if cs >= 0.7:
            _add(findings, "visuels", "fail", f"cover presque identique à « {p['cover']['text']} »", d)
        if p.get("theme") == post.get("theme") and my_vis:
            shared = len(my_vis & visuals(p)) / len(my_vis)
            if shared >= 0.5:
                _add(findings, "visuels", "warn", f"{shared:.0%} des visuels déjà utilisés sur ce thème", d)
        # CTA
        s = similarity(post.get("cta", ""), p.get("cta", ""))
        if s >= 0.85:
            _add(findings, "cta", "fail", f"CTA identique à celui du jour {d}", d)
        elif s >= 0.6 and p in history[-10:]:
            _add(findings, "cta", "warn", f"CTA proche de « {p.get('cta')} » ({s:.0%})", d)
        # formulation : phrases reprises mot pour mot
        other = shingles(script_text(p))
        if my_script and other:
            overlap = len(my_script & other) / len(my_script)
            if overlap >= 0.2:
                _add(findings, "formulation", "fail", f"{overlap:.0%} du texte déjà écrit au jour {d}", d)
            elif overlap >= 0.1:
                _add(findings, "formulation", "warn", f"{overlap:.0%} du texte déjà écrit au jour {d}", d)
    if last and hook_type(post) and hook_type(post) == hook_type(last):
        _add(findings, "hook", "warn", f"même type de hook (« {hook_type(post)} ») que la publication précédente", last.get("day"))
    return summarize(findings)


def summarize(findings: list[dict]) -> dict:
    rank = {"ok": 0, "warn": 1, "fail": 2}
    dims = {}
    for dim in DIMENSIONS:
        items = [f for f in findings if f["dimension"] == dim]
        level = max((f["level"] for f in items), key=rank.get, default="ok")
        dims[dim] = {"level": level, "details": [f"{f['detail']}" + (f" (jour {f['day']})" if f["day"] else "")
                                                   for f in items if f["level"] != "ok"] or
                     [f["detail"] for f in items] or ["rien de comparable"]}
    worst = max((d["level"] for d in dims.values()), key=rank.get)
    return {"level": worst, "dimensions": dims}
