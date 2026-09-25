"""Script : brouillon structuré et vérification du style parlé.

L'écriture du texte est faite par Claude Code (aucune API de génération n'est
appelée ici). Ce module prépare le squelette d'un post à partir du calendrier,
de l'idée et de la recherche, puis vérifie que le script respecte la structure
HOOK → PROMESSE → INFORMATION → EXEMPLE / SURPRISE → CONCLUSION → CTA et qu'il
est écrit pour être dit, pas lu.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from content.repetition import check_candidate, fold

ROOT = Path(__file__).resolve().parents[2]
PRODUCTION = json.loads((ROOT / "config" / "production.json").read_text(encoding="utf-8"))
VIDEO = json.loads((ROOT / "config" / "video-style.json").read_text(encoding="utf-8"))
CAROUSEL = json.loads((ROOT / "config" / "carousel-style.json").read_text(encoding="utf-8"))
HOOK_TYPES = PRODUCTION["hooks"]["types"]
TODO = "À ÉCRIRE"
WORDS_PER_SEC = VIDEO["voice"]["words_per_second_estimate"]

ROLE_ALIASES = {"contexte": "promesse", "info": "information", "exemple": "surprise", "resume": "conclusion"}
SLOW_OPENINGS = ("bonjour", "salut a tous", "salut tout le monde", "aujourd'hui on va", "aujourd'hui nous allons",
                 "dans cette video", "dans cette vidéo", "bienvenue")
WRITTEN_WORDS = ("neanmoins", "par consequent", "en outre", "ainsi que", "dont", "lequel", "laquelle",
                 "toutefois", "de surcroit", "en effet")
GENERALIZATIONS = (r"les peruviens (font|mangent|boivent|sont|disent) toujours", r"tous les peruviens",
                   r"au perou,? tout le monde", r"les peruviens ne .* jamais")


def role(u: dict) -> str:
    return ROLE_ALIASES.get(u.get("role", ""), u.get("role", ""))


def words(text: str) -> list[str]:
    return [w for w in re.split(r"\s+", text.strip()) if re.search(r"\w", w)]


def sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.?!…])\s+", text.strip()) if words(s)]


def seo_fields(post: dict) -> dict:
    """SEO au format V2, en acceptant les anciens noms (main, secondary, question)."""
    s = post.get("seo", {})
    return {"primary_keyword": s.get("primary_keyword") or s.get("main", ""),
            "secondary_keywords": s.get("secondary_keywords") or s.get("secondary", []),
            "search_phrase": s.get("search_phrase") or s.get("question", ""),
            "onscreen": s.get("onscreen") or s.get("primary_keyword") or s.get("main", ""),
            "expressions": s.get("expressions", [])}


# ---------------------------------------------------------------- brouillon

def draft(entry: dict, idea: dict | None, research_path: str) -> dict:
    """Squelette d'un post : tout ce qui est à écrire est marqué « À ÉCRIRE »."""
    fmt = entry["format"]
    base = {
        "day": entry["day"], "date": entry["date"], "slug": entry["slug"], "title": entry["subject"],
        "category": entry["category"], "format": fmt, "research": research_path,
        "idea_id": entry.get("idea_id"), "theme": (idea or {}).get("theme"), "type_angle": (idea or {}).get("angle_type"),
        "bank_category": entry.get("bank_category") or (idea or {}).get("category"), "pillar": (idea or {}).get("pillar"),
        "angle": f"{TODO} : l'approche précise (différente des publications passées sur ce thème)",
        "promise": f"{TODO} : pourquoi regarder", "information": f"{TODO} : ce qu'on apprend",
        "emotion": f"{TODO} : surprise, curiosité, amusement, émerveillement ou envie de découvrir",
        "interaction": f"{TODO} : pourquoi commenter",
        "hooks": [f"{TODO} : hook {i + 1}" for i in range(5)],
        "hook_types": [f"{TODO} : un type parmi {', '.join(HOOK_TYPES)}"] * 5,
        "hook_selected": 0, "hook_reason": f"{TODO}",
        "seo": {"primary_keyword": TODO, "secondary_keywords": [TODO], "search_phrase": TODO, "onscreen": TODO,
                "expressions": []},
        "cta": TODO, "question": TODO,
        "cover": {"text": f"{TODO} (3 à 7 mots)", "emoji": "🇵🇪", "palette": "rojo", "illustration": "🇵🇪"},
        "caption": f"{TODO} : hook court, information principale, question, CTA",
        "hashtags": ["#Perou", "#TioClem"], "human_checks": [],
        "repetition_precheck": check_candidate(entry["subject"], (idea or {}).get("theme"),
                                               (idea or {}).get("angle_type"), fmt, idea_id=entry.get("idea_id"),
                                               day=entry["day"], date=entry["date"]),
    }
    palettes = ["rojo", "crema", "mar", "ají", "selva"]
    if fmt == "carrousel":
        roles = ["hook", "promesse", "information", "information", "information", "surprise", "conclusion", "cta"]
        base["slides"] = [{"id": f"slide{i + 1:02d}", "role": r, "title": f"{TODO} : {r}", "body": f"{TODO}",
                           "emoji": "🇵🇪", "palette": palettes[i % 5], "facts": []} for i, r in enumerate(roles)]
    else:
        roles = ["hook", "promesse", "information", "information", "information", "surprise", "conclusion", "cta"]
        base["scenes"] = [{"id": f"scene{i + 1:02d}", "role": r, "voiceover": f"{TODO} : {r}",
                           "on_screen": {"title": TODO, "emoji": "🇵🇪", "subtitle": ""},
                           "visual": {"need": TODO, "description": TODO, "emoji": "🇵🇪", "palette": palettes[i % 5]},
                           "animation": "zoom léger + titre qui pop", "transition": "coupe", "asset_type": "image",
                           "facts": []} for i, r in enumerate(roles)]
    return base


# ---------------------------------------------------------------- vérification

def lint(post: dict) -> dict:
    errors, warnings = [], []
    blob = json.dumps(post, ensure_ascii=False)
    if TODO in blob:
        errors.append(f"{blob.count(TODO)} passage(s) encore « {TODO} »")
    fmt = post.get("format")
    units = post.get("scenes") if fmt == "video" else post.get("slides")
    if not units:
        return {"errors": errors + ["aucune scène ni slide"], "warnings": warnings}

    # hooks
    hooks, types = post.get("hooks", []), post.get("hook_types", [])
    if len(hooks) != PRODUCTION["hooks"]["count"]:
        errors.append(f"{len(hooks)} hooks au lieu de {PRODUCTION['hooks']['count']}")
    if len(types) != len(hooks) or any(t not in HOOK_TYPES for t in types):
        errors.append(f"hook_types manquants ou hors liste ({', '.join(HOOK_TYPES)})")
    elif len(set(types)) < 3:
        warnings.append("moins de 3 types de hook différents")

    # structure
    roles = [role(u) for u in units]
    if roles[0] != "hook":
        errors.append("la première scène n'est pas le hook")
    if roles[-1] != "cta":
        errors.append("la dernière scène n'est pas le CTA")
    if "information" not in roles:
        errors.append("aucune scène « information »")
    if "surprise" not in roles:
        warnings.append("pas d'exemple ni de surprise")
    if "promesse" not in roles:
        warnings.append("pas de promesse après le hook")
    if "conclusion" not in roles:
        warnings.append("pas de conclusion distincte (acceptable si le CTA conclut)")

    seo = seo_fields(post)
    if fmt == "video":
        text = " ".join(u.get("voiceover", "") for u in units)
        est = len(words(text)) / WORDS_PER_SEC + 0.4 * len(units)
        lo, hi = VIDEO["duration"]["min_s"], VIDEO["duration"]["max_s"]
        if not lo <= est <= hi:
            errors.append(f"durée estimée {est:.0f} s hors {lo}–{hi} s")
        first = fold(units[0].get("voiceover", ""))
        if first.startswith(tuple(fold(s) for s in SLOW_OPENINGS)):
            errors.append("la vidéo commence par une introduction lente")
        long_ = [s for s in sentences(text) if len(words(s)) > 18]
        if long_:
            warnings.append(f"{len(long_)} phrase(s) de plus de 18 mots, à couper pour l'oral")
        sents = sentences(text)
        if sents and sum(len(words(s)) for s in sents) / len(sents) > 13:
            warnings.append("phrases trop longues en moyenne pour être dites")
    else:
        text = " ".join(f"{u.get('title', '')} {u.get('body', '')}" for u in units)
        n = len(units)
        if not CAROUSEL["slides"]["min"] <= n <= CAROUSEL["slides"]["max"]:
            errors.append(f"{n} slides hors {CAROUSEL['slides']['min']}–{CAROUSEL['slides']['max']}")
        heavy = [u["id"] for u in units if len(u.get("body", "")) > CAROUSEL["limits"]["body_max_chars"]
                 or len(words(u.get("title", ""))) > CAROUSEL["limits"]["title_max_words"]]
        if heavy:
            errors.append(f"slides trop chargées : {heavy}")

    ft = fold(text)
    written = [w for w in WRITTEN_WORDS if re.search(rf"\b{w}\b", ft)]
    if written:
        warnings.append(f"tournures écrites plutôt qu'orales : {', '.join(written)}")
    gen = [g for g in GENERALIZATIONS if re.search(g, ft)]
    if gen:
        warnings.append("généralisation sur « les Péruviens » : préciser (certaines régions, beaucoup de familles…)")

    # SEO
    pk = fold(seo["primary_keyword"])
    if not pk or pk == fold(TODO):
        errors.append("primary_keyword absent")
    else:
        if pk not in ft:
            errors.append(f"« {seo['primary_keyword']} » absent de la voix / du texte")
        if pk not in fold(post.get("caption", "")):
            errors.append(f"« {seo['primary_keyword']} » absent de la description")
        hook_txt = fold(post["hooks"][post.get("hook_selected", 0)]) if hooks else ""
        screen = fold(" ".join(u.get("on_screen", {}).get("title", "") + " " + u.get("title", "") for u in units))
        if pk not in hook_txt and fold(seo["onscreen"]) not in screen:
            warnings.append("mot-clé principal ni dans le hook ni à l'écran")
    if seo["secondary_keywords"] and not any(fold(k) in ft or fold(k) in fold(post.get("caption", ""))
                                             for k in seo["secondary_keywords"]):
        warnings.append("aucun mot-clé secondaire dans le texte ni la description")
    if not seo["search_phrase"]:
        warnings.append("search_phrase absente")
    return {"errors": errors, "warnings": warnings}
