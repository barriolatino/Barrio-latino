"""Banque d'idées Tio Clem : sélection, rotation, anti-répétition, apprentissage.

Les scores et les statistiques servent uniquement à choisir les sujets ;
ils ne sont jamais montrés au public.
"""
from __future__ import annotations

import datetime as dt
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TOPICS = ROOT / "content" / "topics.json"
ANGLES = ROOT / "content" / "angles.json"
PUBLISHED = ROOT / "content" / "published.json"

# Part visée de chaque catégorie dans le fil (cuisine en tête : c'est l'ADN du compte).
TARGET_SHARE = {"cuisine": 0.20, "boissons": 0.08, "histoire": 0.13, "geographie": 0.12, "culture": 0.12,
                "langue": 0.12, "insolite": 0.10, "degustation": 0.06, "interaction": 0.07}
MAX_SAME_CATEGORY_IN_A_ROW = 2
THEME_COOLDOWN = 5        # un thème ne revient pas dans les 5 publications suivantes
ANGLE_COOLDOWN = 3        # un type d'angle évite de revenir dans les 3 suivantes
REQUIRED_KEYS = {"id", "categorie", "sous_categorie", "theme", "sujet", "angle", "type_angle", "format",
                 "difficulte", "tournage_requis", "scores", "utilisations", "derniere_utilisation"}
SCORE_KEYS = ("recherche", "curiosite", "visuel", "commentaire", "partage", "originalite", "pertinence")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def topics() -> dict:
    return load(TOPICS)


def angles() -> dict:
    return load(ANGLES)


def timeline() -> list[dict]:
    """Publications produites, dans l'ordre du fil."""
    pubs = load(PUBLISHED)["publications"] if PUBLISHED.exists() else []
    return sorted(pubs, key=lambda p: (p["date"], p["day"]))


def topic_by_id(tid: str) -> dict | None:
    return next((t for t in topics()["topics"] if t["id"] == tid), None)


# ---------------------------------------------------------------- apprentissage

def engagement(perf: dict) -> float | None:
    views = perf.get("vues") or 0
    if views <= 0:
        return None
    return (perf.get("likes", 0) + 3 * perf.get("commentaires", 0) + 4 * perf.get("partages", 0)
            + 3 * perf.get("enregistrements", 0)) / views


def performance_bias(pubs: list[dict], key: str) -> dict[str, float]:
    """Écart relatif d'engagement par valeur de `key` (catégorie, angle…), de -1 à +1."""
    rows = [(p.get(key), engagement(p.get("performance", {}))) for p in pubs]
    rows = [(k, e) for k, e in rows if k and e is not None]
    if len(rows) < 3:
        return {}
    mean = sum(e for _, e in rows) / len(rows) or 1e-9
    by = {}
    for k, e in rows:
        by.setdefault(k, []).append(e)
    return {k: max(-1.0, min(1.0, (sum(v) / len(v) - mean) / mean)) for k, v in by.items()}


# ---------------------------------------------------------------- règles

def rotation_ok(category: str, previous: list[str]) -> bool:
    tail = previous[-MAX_SAME_CATEGORY_IN_A_ROW:]
    return not (len(tail) == MAX_SAME_CATEGORY_IN_A_ROW and all(c == category for c in tail))


def used_combos(pubs: list[dict]) -> set[tuple[str, str]]:
    return {(p.get("theme"), p.get("type_angle")) for p in pubs if p.get("theme")}


def repetition_problems(post: dict, pubs: list[dict]) -> list[str]:
    """Règles de la banque appliquées à un post (utilisé par le contrôle qualité)."""
    problems = []
    before = [p for p in pubs if (p["date"], p["day"]) < (post["date"], post["day"])]
    cat = post.get("bank_category")
    if cat and not rotation_ok(cat, [p.get("bank_category") for p in before]):
        problems.append(f"3e publication de suite en catégorie « {cat} »")
    theme, atype = post.get("theme"), post.get("type_angle")
    for p in pubs:
        if p["day"] == post["day"]:
            continue
        if theme and p.get("theme") == theme and p.get("type_angle") == atype:
            problems.append(f"thème « {theme} » déjà traité avec l'angle « {atype} » (jour {p['day']})")
    recent = [p.get("theme") for p in before[-THEME_COOLDOWN:]]
    if theme and theme in recent:
        problems.append(f"thème « {theme} » déjà traité dans les {THEME_COOLDOWN} dernières publications")
    return problems


# ---------------------------------------------------------------- sélection

def pick(n: int = 5, fmt: str | None = None, category: str | None = None, filming: bool = False) -> list[dict]:
    pubs = timeline()
    cats = [p.get("bank_category") for p in pubs]
    counts = Counter(c for c in cats if c)
    total = max(1, len(pubs))
    combos = used_combos(pubs)
    used_ids = {p.get("topic_id") for p in pubs}
    recent_themes = [p.get("theme") for p in pubs[-THEME_COOLDOWN:]]
    recent_angles = [p.get("type_angle") for p in pubs[-ANGLE_COOLDOWN:]]
    last_fmt = pubs[-1]["format"] if pubs else None
    themes_ever = {p.get("theme") for p in pubs}
    cat_bias = performance_bias(pubs, "bank_category")
    angle_bias = performance_bias(pubs, "type_angle")

    ranked = []
    for t in topics()["topics"]:
        if fmt and t["format"] != fmt and not (fmt == "video" and t["format"] == "quiz"):
            continue
        if category and t["categorie"] != category:
            continue
        if t["id"] in used_ids or (t["theme"], t["type_angle"]) in combos:
            continue
        if not rotation_ok(t["categorie"], cats) or t["theme"] in recent_themes:
            continue
        why = []
        score = t["score_total"] / 70 * 100
        deficit = TARGET_SHARE.get(t["categorie"], 0.1) - counts[t["categorie"]] / total
        score += deficit * 60
        if deficit > 0.03:
            why.append("catégorie sous-représentée")
        if t["type_angle"] in recent_angles:
            score -= 6
        if last_fmt and t["format"] == last_fmt:
            score -= 3
        if t["theme"] in themes_ever:
            score -= 4
            why.append("thème déjà vu, nouvel angle")
        if t["tournage_requis"] and not filming:
            score -= 8
            why.append("tournage requis")
        if t["categorie"] in cat_bias:
            score += 8 * cat_bias[t["categorie"]]
            why.append(f"engagement catégorie {cat_bias[t['categorie']]:+.0%}")
        if t["type_angle"] in angle_bias:
            score += 5 * angle_bias[t["type_angle"]]
        ranked.append({**t, "selection": round(score, 1), "raisons": why})
    ranked.sort(key=lambda t: -t["selection"])
    if category:
        return ranked[:n]
    # liste variée : au plus 2 idées par catégorie, et jamais deux fois le même thème
    out, per_cat, seen = [], Counter(), set()
    for t in ranked:
        if per_cat[t["categorie"]] < 2 and t["theme"] not in seen:
            out.append(t)
            per_cat[t["categorie"]] += 1
            seen.add(t["theme"])
        if len(out) == n:
            break
    return out


# ---------------------------------------------------------------- nouvelles idées

TEMPLATES = {
    "histoire": "{s} : d'où ça vient vraiment ?",
    "comparaison": "{s} : ce qui change entre la France et le Pérou",
    "decouverte": "{s} : tu connais ?",
    "quiz": "Quiz : que sais-tu vraiment sur {s} ?",
    "degustation": "Je goûte {s}",
    "anecdote": "L'anecdote que personne ne raconte sur {s}",
    "explication": "{s} expliqué simplement",
    "top": "5 choses à savoir sur {s}",
    "question": "Pourquoi {s} compte autant au Pérou ?",
    "reaction": "Je fais découvrir {s} à un Français",
    "storytelling": "Ma première fois avec {s}",
    "voyage": "{s} : ce qu'il faut savoir avant d'y aller",
    "culture": "Ce que {s} dit de la culture péruvienne",
    "insolite": "Le détail surprenant sur {s}",
    "tu-preferes": "{s} ou … ? Tu préfères quoi ?",
}


# Thèmes qui décrivent un format (jeu, série, panorama) plutôt qu'un sujet :
# on ne leur greffe pas d'autres angles.
NON_SUBJECT_THEMES = {"faits-perou", "communaute", "devine", "faire-gouter", "aliments-surprenants", "premier-voyage",
                      "traditions", "produits-peruviens", "mot-du-jour", "expression-du-jour", "destinations",
                      "produit-mystere", "plage-montagne", "lima-cusco", "francais-espagnol", "intraduisibles",
                      "registre", "vocabulaire-quotidien", "animaux", "mots-peruviens", "expressions", "argot"}


# Angles réservés à certaines catégories (on ne « goûte » pas une fête religieuse).
EDIBLE = {"cuisine", "boissons", "degustation"}
ANGLE_CATEGORIES = {
    "degustation": EDIBLE, "reaction": EDIBLE,
    "tu-preferes": EDIBLE | {"geographie", "interaction"},
    "voyage": {"geographie", "culture", "histoire", "insolite"},
    "storytelling": EDIBLE | {"histoire", "culture", "geographie"},
    "comparaison": EDIBLE | {"culture", "langue", "geographie"},
}


def combine(n: int = 20) -> list[dict]:
    """Nouvelles combinaisons SUJET + ANGLE + FORMAT + PUBLIC + ÉMOTION jamais utilisées."""
    tp = topics()["topics"]
    ang = angles()
    pubs = timeline()
    used = used_combos(pubs) | {(t["theme"], t["type_angle"]) for t in tp}
    counts = Counter(p.get("bank_category") for p in pubs)
    total = max(1, len(pubs))
    by_theme = {}
    for t in tp:
        by_theme.setdefault(t["theme"], []).append(t)
    out = []
    k = 0
    for theme, items in by_theme.items():
        if theme in NON_SUBJECT_THEMES:
            continue
        ref = max(items, key=lambda t: t["score_total"])
        subject = min((t["sujet"] for t in items), key=len)
        for a in ang["angles"]:
            if (theme, a["id"]) in used:
                continue
            allowed = ANGLE_CATEGORIES.get(a["id"])
            if allowed and ref["categorie"] not in allowed:
                continue
            deficit = TARGET_SHARE.get(ref["categorie"], 0.1) - counts[ref["categorie"]] / total
            score = ref["score_total"] / 70 * 100 + deficit * 60 + (4 if len(items) == 1 else 0)
            out.append({
                "theme": theme, "categorie": ref["categorie"], "sujet": subject, "type_angle": a["id"],
                "format": a["formats"][0], "public": ang["publics"][k % len(ang["publics"])],
                "emotion": a["emotion"], "titre_brouillon": TEMPLATES[a["id"]].format(s=subject),
                "tournage_requis": a["id"] in ("degustation", "reaction"), "selection": round(score, 1)})
            k += 1
    out.sort(key=lambda o: -o["selection"])
    # varier : pas plus de 2 idées par thème et par catégorie dans la liste proposée
    picked, per_theme, per_cat, per_angle = [], Counter(), Counter(), Counter()
    for o in out:
        if (per_theme[o["theme"]] < 1 and per_cat[o["categorie"]] < max(2, n // 5)
                and per_angle[o["type_angle"]] < max(2, n // 6)):
            picked.append(o)
            per_theme[o["theme"]] += 1
            per_cat[o["categorie"]] += 1
            per_angle[o["type_angle"]] += 1
        if len(picked) == n:
            break
    return picked


def next_topic_id() -> str:
    return f"{max(int(t['id']) for t in topics()['topics']) + 1:03d}"


# ---------------------------------------------------------------- suivi

def mark_used(topic_id: str | None, day: int, date: str, post: dict) -> None:
    if not topic_id:
        return
    data = topics()
    for t in data["topics"]:
        if t["id"] == topic_id:
            t["utilisations"] = [u for u in t["utilisations"] if u["day"] != day] + [
                {"day": day, "date": date, "type_angle": post.get("type_angle"), "format": post["format"]}]
            t["derniere_utilisation"] = max(u["date"] for u in t["utilisations"])
    save(TOPICS, data)


def report() -> dict:
    data = topics()
    pubs = timeline()
    tp = data["topics"]
    counts = Counter(p.get("bank_category") for p in pubs)
    total = max(1, len(pubs))
    unused = [t for t in tp if not t["utilisations"]]
    cats = {}
    for c in data["categories"]:
        cats[c] = {"banque": sum(t["categorie"] == c for t in tp), "restantes": sum(t["categorie"] == c for t in unused),
                   "publiees": counts[c], "part": round(counts[c] / total, 2), "cible": TARGET_SHARE.get(c)}
    problems = []
    for t in tp:
        missing = REQUIRED_KEYS - t.keys()
        if missing:
            problems.append(f"{t.get('id')} : champs manquants {sorted(missing)}")
        elif set(t["scores"]) != set(SCORE_KEYS) or not all(1 <= v <= 10 for v in t["scores"].values()):
            problems.append(f"{t['id']} : scores invalides")
    ids = [t["id"] for t in tp]
    if len(ids) != len(set(ids)):
        problems.append("identifiants en double")
    under = sorted((c for c in cats if cats[c]["cible"] and cats[c]["part"] < cats[c]["cible"] - 0.03),
                   key=lambda c: cats[c]["part"] - cats[c]["cible"])
    ang = {a["id"]: a.get("intention") for a in angles()["angles"]}
    mix = Counter(ang.get(p.get("type_angle")) for p in pubs[-10:] if ang.get(p.get("type_angle")))
    return {"idees": len(tp), "intentions_10_dernieres": dict(mix), "restantes": len(unused), "categories": cats, "sous_representees": under,
            "angles_utilises": dict(Counter(p.get("type_angle") for p in pubs)),
            "formats_utilises": dict(Counter(p["format"] for p in pubs)),
            "a_regenerer": len(unused) < 40, "problemes": problems,
            "genere_le": dt.date.today().isoformat()}
