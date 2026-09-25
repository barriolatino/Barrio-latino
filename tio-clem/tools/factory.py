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

from subtitles.srt import build_cues, parse_srt, readability, sync_to_voice, syllables, write_srt  # noqa: F401

ROOT = Path(__file__).resolve().parent.parent  # racine du projet tio-clem/
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


def readme_text(post: dict, duration: float | None, status: str, sources: list[dict], qa: dict,
                credits: list[str] | None = None) -> str:
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

CRÉDITS IMAGES (à citer dans la description si la licence l'exige) :
{chr(10).join("  - " + c for c in credits or []) or "  (aucune image sous licence à créditer)"}

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
    from content.script import seo_fields
    seo = seo_fields(post)
    for s in seo["expressions"] + seo["secondary_keywords"]:
        allowed |= {fold(w) for w in re.findall(r"\w+", s)}
    allowed |= {fold(w) for w in re.findall(r"\w+", json.dumps(research, ensure_ascii=False))}
    lexique = ROOT / "config" / "lexique.txt"
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
    from research.validate import validate as validate_research
    from content.script import lint
    rv = validate_research(research, post, post.get("bank_category"))
    c["recherche"] = {"level": "fail" if rv["errors"] else ("warn" if rv["warnings"] else "ok"),
                      "detail": "; ".join(rv["errors"] + rv["warnings"]) or
                                f"politique de sources respectée ({len(rv['sources_used'])} sources utilisées)"}
    sl = lint(post)
    c["script"] = {"level": "fail" if sl["errors"] else ("warn" if sl["warnings"] else "ok"),
                   "detail": "; ".join(sl["errors"] + sl["warnings"]) or "structure et style oral conformes"}
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
        # avec une vraie voix, le débit mesuré est celui du créateur : plus de marge
        from voice.providers import human_voice
        max_rate = 4.3 if human_voice(post["day"]) else 3.4
        for sc in post["scenes"]:
            r = len(words(sc["voiceover"])) / sc["duration"]
            if not 1.6 <= r <= max_rate or sc["duration"] > 8:
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
            r = readability(cues, d)
            level = "fail" if r["errors"] else ("warn" if r["warnings"] else "ok")
            c["sous_titres"] = {"level": level, "detail": "; ".join(r["errors"] + r["warnings"]) or
                                f"{len(cues)} sous-titres lisibles, incrustés en zone sûre"}
        except (OSError, ValueError) as e:
            c["sous_titres"] = check(False, str(e))
    else:
        c["sous_titres"] = check(True, "sans objet (carrousel)")

    # voix, visuels, MOCK (tools/voice, tools/images)
    assets = load(outdir / "assets.json") if (outdir / "assets.json").exists() else {"voice": None, "visuals": {}}
    mocks = []
    if fmt == "video":
        v = assets.get("voice") or {"source": "none"}
        if v.get("mock"):
            mocks.append("voix")
        if v["source"] == "human":
            c["voix"] = check(True, f"voix de Tio Clem ({v.get('file')})")
        elif v["source"] == "tts":
            live = v.get("tested_live")
            c["voix"] = {"level": "fail" if v.get("mock") else ("ok" if live else "warn"),
                         "detail": f"synthèse {v.get('provider')} {v.get('voice', '')}".strip()
                                   + ("" if live else " — fournisseur jamais testé en réel : écouter avant de publier")}
        else:
            c["voix"] = check(False, "piste silencieuse : enregistrer la voix off ou ajouter un son dans TikTok", "warn")
    from images import sourced
    vis_err, vis_warn, kinds = [], [], {}
    for uid, m in (assets.get("visuals") or {}).items():
        kinds[m.get("type")] = kinds.get(m.get("type"), 0) + 1
        if m.get("mock"):
            mocks.append(f"visuel {uid}")
        if m.get("type") == "sourced":
            vis_err += [f"{uid} : {e}" for e in sourced.check(m)]
        if m.get("type") == "generated":
            if not m.get("prompt"):
                vis_err.append(f"{uid} : image générée sans prompt enregistré")
            if not m.get("tested_live") and not m.get("mock"):
                vis_warn.append(f"{uid} : fournisseur d'images jamais testé en réel")
    c["visuels"] = {"level": "fail" if vis_err else ("warn" if vis_warn else "ok"),
                    "detail": "; ".join(vis_err + vis_warn) or
                              ", ".join(f"{n} {k}" for k, n in sorted(kinds.items(), key=lambda x: str(x[0]))) or "cartes"}
    c["mock_absent"] = check(not mocks, "aucun asset MOCK" if not mocks else
                             f"assets MOCK (tests uniquement) : {', '.join(mocks)}")

    # CTA
    last = units[-1]
    cta_ok = last.get("role") == "cta" and "?" in (last.get("voiceover", "") + last.get("title", "") + last.get("body", ""))
    winner = [w for w in WINNER_WORDS if w in fold(post["caption"] + post["cta"])]
    if post["category"] in ("interaction", "quiz") and winner:
        cta_ok = False
    c["cta"] = check(cta_ok and "?" in post["question"], post["cta"] + (f" — gagnant désigné : {winner}" if winner else ""))

    # description + SEO
    from content.script import seo_fields
    seo = seo_fields(post)
    main = fold(seo["primary_keyword"])
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
        if fold(seo["onscreen"]) not in screen:
            desc.append("mot-clé absent du texte à l'écran")
        if cap.count(main) > 2:
            desc.append("mot-clé répété plus de 2 fois (bourrage)")
    if "#" in post["caption"]:
        desc.append("hashtags dans la description (ils sont ajoutés à part)")
    if len(caption_text(post)) > 2200:
        desc.append("description trop longue")
    if "?" not in post["caption"]:
        desc.append("pas de question dans la description")
    c["description"] = check(not desc, "; ".join(desc) or f"{len(post['caption'])} caractères, mot-clé « {seo['primary_keyword']} »")

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

    # répétitions : dans le post (tournures reprises) et avec les publications produites (8 dimensions)
    internal, grams = [], {}
    for u in units:
        ws = [fold(w) for w in words(u.get("voiceover", "") + " " + u.get("body", ""))]
        for i in range(len(ws) - 3):
            g = " ".join(ws[i:i + 4])
            if g in grams and grams[g] != u["id"]:
                internal.append(f"« {g} » répété ({grams[g]} et {u['id']})")
            grams.setdefault(g, u["id"])
    from content import repetition
    report = repetition.check_post(post)
    rep = [f"{dim} : " + " ; ".join(r["details"]) for dim, r in report["dimensions"].items() if r["level"] != "ok"]
    level = report["level"]
    if internal and level == "ok":
        level = "warn"
    c["absence_de_repetition"] = {"level": level, "detail": "; ".join(internal + rep) or "aucune répétition sur les 8 dimensions",
                                  "dimensions": {k: v["level"] for k, v in report["dimensions"].items()}}

    # banque d'idées : rattachement, rotation des catégories, thème + angle déjà utilisés
    from content import selection as bank
    missing = [k for k in ("idea_id", "theme", "type_angle", "bank_category") if not post.get(k)]
    bank_pb = [f"champs manquants : {', '.join(missing)}"] if missing else []
    if post.get("idea_id") and not bank.idea_by_id(post["idea_id"]):
        bank_pb.append(f"idée {post['idea_id']} absente de content/ideas.json")
    if post.get("bank_category") and post["bank_category"] not in bank.PILLAR_OF_CATEGORY:
        bank_pb.append(f"catégorie inconnue : {post['bank_category']}")
    bank_pb += bank.rotation_problems(post, history()["publications"])
    c["rotation_et_banque"] = check(not bank_pb, "; ".join(bank_pb) or
                                    f"idée {post.get('idea_id')} · {post.get('bank_category')} · angle {post.get('type_angle')}")

    fails = [k for k, v in c.items() if v["level"] == "fail"]
    return {"status": READY if not fails else REVIEW, "fails": fails,
            "warnings": [k for k, v in c.items() if v["level"] == "warn"], "checks": c,
            "checked_at": dt.datetime.now().isoformat(timespec="seconds")}


# ---------------------------------------------------------------- construction

def visual_for(post: dict, unit: dict, assets: dict) -> Path | None:
    """Image d'une scène, d'une slide ou de la cover (tools/images) ; la fiche va dans assets.json."""
    from images import providers as images
    path, meta = images.resolve(post, unit)
    assets["visuals"][unit["id"]] = meta
    return path


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
    assets = {"voice": None, "visuals": {}}

    # cover
    cv = post["cover"]
    bg, fg, b = render.render_card({"title": cv["text"], "badge_emoji": cv.get("emoji"), "emoji": cv.get("illustration", "🇵🇪"),
                                    "palette": cv.get("palette", "rojo"), "big": True},
                                   visual_for(post, {"id": "cover", "visual": {}}, assets))
    render.flatten(bg, fg).save(outdir / "cover.jpg", quality=92)
    boxes["cover"] = b

    duration = None
    if post["format"] == "video":
        for i, sc in enumerate(post["scenes"]):
            sc["duration"] = scene_duration(sc, i == 0)
        from voice import providers as voices
        if voice_arg:
            voice, vmeta = Path(voice_arg), {"source": "human", "file": voice_arg, "mock": False}
        else:
            voice, vmeta = voices.resolve(post)
        assets["voice"] = vmeta
        voice_cues = None
        if voice and voice.exists():
            voices.export_wav(voice, outdir / "voiceover.wav")
            vlen = render.probe_duration(voice)
            voice_cues = sync_to_voice(post["scenes"], vlen, render.detect_silences(voice, -35, 0.12))
            log.append(f"voix off {voice.name} ({vlen:.1f} s, {len(voice_cues)} sous-titres) : scènes et sous-titres calés sur la voix")
        frames = []
        for sc in post["scenes"]:
            os_ = sc["on_screen"]
            card = {"title": os_["title"], "subtitle": os_.get("subtitle"), "badge_emoji": None,
                    "emoji": sc["visual"].get("emoji") or os_.get("emoji"), "palette": sc["visual"].get("palette", "rojo"),
                    "number": sc.get("number")}
            if sc["role"] == "hook":
                card["badge_emoji"] = os_.get("emoji")
            bg, fg, b = render.render_card(card, visual_for(post, sc, assets))
            boxes[sc["id"]] = b
            frames.append({"bg": bg, "fg": fg, "duration": sc["duration"], "animation": sc.get("animation", "")})
        cues = voice_cues or build_cues(post["scenes"])
        write_srt(cues, outdir / "subtitles.srt")
        render.render_video(frames, cues, outdir / "video.mp4", voice if voice and voice.exists() else None)
        duration = sum(s["duration"] for s in post["scenes"])
        scenes_out = []
        t = 0.0
        for n, sc in enumerate(post["scenes"], 1):
            overlay = sc["on_screen"]["title"] + (f" {sc['on_screen']['emoji']}" if sc["role"] == "hook" else "")
            scenes_out.append({
                # format V2 (storyboard)
                "scene": n, "duration": round(sc["duration"], 2), "voiceover": sc["voiceover"],
                "visual": sc["visual"]["need"], "text_overlay": overlay,
                "transition": sc.get("transition", "coupe"), "asset_type": sc.get("asset_type", "image"),
                # détails de production
                "role": sc["role"], "start": round(t, 2), "visual_description": sc["visual"]["description"],
                "text_overlay_sub": sc["on_screen"].get("subtitle", ""), "animation": sc.get("animation", ""),
                "facts": sc.get("facts", []), "asset": assets["visuals"].get(sc["id"], {}).get("type", "card"),
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
            bg, fg, b = render.render_card(card, visual_for(post, sl, assets))
            render.flatten(bg, fg).save(sdir / f"{i:02d}.jpg", quality=92)
            boxes[sl["id"]] = b
        save(outdir / "scenes.json", {"format": "carrousel 1080x1920", "slides": post["slides"]})

    used = {fid for u in post.get("scenes", post.get("slides", [])) for fid in u.get("facts", [])}
    used_src = {s for f in research["faits"] if f["id"] in used for s in f["sources"]}
    sources = [s for s in research["sources"] if s["id"] in used_src]
    from research.validate import sources_json
    save(outdir / "sources.json", sources_json(research, used))  # format V2 ; détails dans post["research"]
    save(outdir / "assets.json", assets)
    from images.sourced import credit
    credits = [f"{uid} : {credit(m)}" for uid, m in assets["visuals"].items()
               if m.get("type") == "sourced" and m.get("attribution_required")]
    (outdir / "script.txt").write_text(script_text(post), encoding="utf-8")
    (outdir / "caption.txt").write_text(caption_text(post), encoding="utf-8")
    (outdir / "hashtags.txt").write_text(" ".join(post["hashtags"]) + "\n", encoding="utf-8")

    qa = run_qa(post, research, outdir, boxes)
    qa["autofix"] = log
    save(outdir / "qa.json", qa)
    (outdir / "README.txt").write_text(readme_text(post, duration, qa["status"], sources, qa, credits), encoding="utf-8")
    save(path, post)  # conserve corrections et durées calculées
    record(post, qa["status"], outdir)
    return qa


def record(post: dict, status: str, outdir: Path) -> None:
    from content.script import seo_fields
    from content import selection as bank
    h = history()
    prev = next((p for p in h["publications"] if p["day"] == post["day"]), {})
    if prev.get("status") == "PUBLISHED" and status == READY:
        status = "PUBLISHED"
    entry = {
        "day": post["day"], "date": post["date"], "subject": post["title"], "category": post["category"],
        "bank_category": post.get("bank_category"), "pillar": bank.pillar_of(post), "idea_id": post.get("idea_id"),
        "theme": post.get("theme"), "type_angle": post.get("type_angle"),
        "format": post["format"], "angle": post.get("angle", ""), "hook": post["hooks"][post["hook_selected"]],
        "keywords": [seo_fields(post)["primary_keyword"], *seo_fields(post)["secondary_keywords"]], "status": status,
        "output": str(outdir.relative_to(ROOT)), "updated_at": dt.datetime.now().isoformat(timespec="seconds"),
    }
    for key in ("performance", "published_at"):
        if key in prev:
            entry[key] = prev[key]
    bank.mark_used(post.get("idea_id"), post["day"], post["date"], post)
    h["publications"] = [p for p in h["publications"] if p["day"] != post["day"]] + [entry]
    h["publications"].sort(key=lambda p: p["day"])
    save(PUBLISHED, h)


# ---------------------------------------------------------------- commandes

def cmd_calendar(_):
    done = {p["day"]: p["status"] for p in history()["publications"]}
    for d in calendar()["days"]:
        pp = post_path(d["day"])
        st = done.get(d["day"]) or (("BROUILLON" if "À ÉCRIRE" in pp.read_text(encoding="utf-8") else "SCRIPT_PRÊT")
                                    if pp.exists() else "À FAIRE")
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
        topic = __import__("content.selection", fromlist=["x"]).idea_by_id(entry.get("idea_id") or "")
        print(json.dumps({**entry, "source": "calendrier", "idee": topic}, ensure_ascii=False, indent=1))
        return
    # calendrier terminé : la banque d'idées prend le relais
    from content import selection as bank
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
    from content import selection as bank
    for t in bank.pick(a.n, a.format, a.category, a.filming):
        print(show_topic(t))


def cmd_bank(_):
    from content import selection as bank
    r = bank.report()
    print(f"{r['idees']} idées, {r['restantes']} jamais utilisées")
    print(f"{'pilier':<30} {'banque':>6} {'restantes':>9} {'publiées':>8} {'part':>6} {'cible':>6}")
    for c, v in r["piliers"].items():
        print(f"{v['nom']:<30} {v['banque']:>6} {v['restantes']:>9} {v['publiees']:>8} {v['part']:>6.0%} {v['cible']:>6.0%}")
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
    from content import selection as bank
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
    e = __import__("content.selection", fromlist=["x"]).engagement(perf)
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


def _print_report(title: str, errors: list, warnings: list) -> None:
    print(title)
    for e in errors:
        print(f"  [ ] {e}")
    for w in warnings:
        print(f"  [~] {w}")
    if not errors and not warnings:
        print("  [x] rien à signaler")


def cmd_draft(a):
    """Crée le squelette de content/posts/day-NN.json (sans jamais écraser un post existant)."""
    from content.script import draft
    from content import selection as bank
    path = post_path(a.day)
    if path.exists():
        sys.exit(f"{path.relative_to(ROOT)} existe déjà : rien n'est écrasé.")
    entry = day_entry(a.day)
    raw = next((i for i in bank.ideas()["ideas"] if i["id"] == entry.get("idea_id")), None)
    research = f"research/{entry['slug']}.json"
    post = draft(entry, raw, research)
    save(path, post)
    print(f"Brouillon créé : {path.relative_to(ROOT)} (recherche attendue : {research})")
    blocking = [f for f in post["repetition_precheck"] if f["level"] == "fail"]
    for f in post["repetition_precheck"]:
        print(f"  [{'!' if f['level'] == 'fail' else '~' if f['level'] == 'warn' else 'i'}] {f['dimension']} : {f['detail']}")
    if blocking:
        print("  → changer d'angle ou d'informations avant d'écrire : ce sujet répète une publication passée.")


def cmd_lint(a):
    from content.script import lint
    r = lint(load(post_path(a.day)))
    _print_report(f"Script du jour {a.day}", r["errors"], r["warnings"])
    sys.exit(1 if r["errors"] else 0)


def cmd_research_check(a):
    from research.validate import validate
    if a.target.isdigit():
        post = load(post_path(int(a.target)))
        research, category = load(ROOT / post["research"]), post.get("bank_category")
    else:
        post, category = None, None
        research = load(ROOT / "research" / f"{a.target}.json")
    r = validate(research, post, category)
    _print_report(f"Recherche « {research.get('sujet', a.target)} »", r["errors"], r["warnings"])
    for src in r["sources_used"]:
        print(f"      {src['publisher'][:40]:<40} {src['read']:<8} {src['url']}")
    sys.exit(1 if r["errors"] else 0)


def cmd_repeat_check(a):
    from content import repetition
    if a.day is not None:
        report = repetition.check_post(load(post_path(a.day)))
        for dim, r in report["dimensions"].items():
            mark = {"ok": "[x]", "warn": "[~]", "fail": "[ ]"}[r["level"]]
            print(f"  {mark} {dim:<13} {' ; '.join(r['details'])}")
        sys.exit(1 if report["level"] == "fail" else 0)
    findings = repetition.check_candidate(a.title, a.theme, a.angle, a.format)
    for f in findings:
        print(f"  [{'!' if f['level'] == 'fail' else '~' if f['level'] == 'warn' else 'i'}] {f['dimension']} : {f['detail']}"
              + (f" (jour {f['day']})" if f.get("day") else ""))
    if not findings:
        print("  [x] aucune publication comparable")
    sys.exit(1 if any(f["level"] == "fail" for f in findings) else 0)


def cmd_asset_add(a):
    """Enregistre une image sourcée (Mode A) pour une scène ou une slide, licence vérifiée."""
    import shutil
    from images import sourced
    src = Path(a.file)
    if not src.is_file():
        sys.exit(f"fichier introuvable : {src}")
    dest = sourced.SOURCED / f"day-{a.day:02d}" / f"{a.unit}{src.suffix.lower()}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)
    try:
        e = sourced.register(str(dest.relative_to(ROOT)), a.license, a.day, a.unit, a.source, a.url, a.author,
                             a.license_url, a.note or "")
    except ValueError as err:
        dest.unlink()
        sys.exit(f"refusé : {err}")
    print(f"Image enregistrée pour le jour {a.day}, {a.unit} : {e['license']}"
          + (" (crédit obligatoire)" if e["attribution_required"] else ""))


def main():
    ap = argparse.ArgumentParser(description="Tio Clem — Content Factory")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("calendar").set_defaults(fn=cmd_calendar)
    sub.add_parser("next").set_defaults(fn=cmd_next)
    b = sub.add_parser("build")
    b.add_argument("day", type=int)
    b.add_argument("--voice", help="fichier audio de voix off (sinon assets/audio/voice/day-NN.*)")
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
    dr = sub.add_parser("draft", help="squelette du post d'un jour du calendrier")
    dr.add_argument("day", type=int)
    dr.set_defaults(fn=cmd_draft)
    li = sub.add_parser("lint", help="structure et style oral du script d'un jour")
    li.add_argument("day", type=int)
    li.set_defaults(fn=cmd_lint)
    rc = sub.add_parser("research-check", help="valide une recherche (numéro de jour ou slug)")
    rc.add_argument("target")
    rc.set_defaults(fn=cmd_research_check)
    rp = sub.add_parser("repeat-check", help="répétition : un jour, ou un sujet candidat (--title)")
    rp.add_argument("day", type=int, nargs="?")
    rp.add_argument("--title")
    rp.add_argument("--theme")
    rp.add_argument("--angle")
    rp.add_argument("--format")
    rp.set_defaults(fn=cmd_repeat_check)
    aa = sub.add_parser("asset-add", help="enregistrer une image sourcée (Mode A) avec sa licence")
    aa.add_argument("file")
    aa.add_argument("--day", type=int, required=True)
    aa.add_argument("--unit", required=True, help="scene03, slide02, cover…")
    aa.add_argument("--license", required=True)
    aa.add_argument("--source", default="")
    aa.add_argument("--url", default="")
    aa.add_argument("--author", default="")
    aa.add_argument("--license-url", dest="license_url", default="")
    aa.add_argument("--note")
    aa.set_defaults(fn=cmd_asset_add)
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
