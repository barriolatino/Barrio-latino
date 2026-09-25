"""Banque d'idées Tio Clem : sélection, rotation, anti-répétition, apprentissage.

Les scores et les statistiques servent uniquement à choisir les sujets ;
ils ne sont jamais montrés au public.
"""
from __future__ import annotations

import datetime as dt
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # racine du projet (tools/content/ → ../..)
IDEAS = ROOT / "content" / "ideas.json"
TOPICS = ROOT / "content" / "topics.json"  # registre des thèmes
PILLARS = ROOT / "config" / "content-pillars.json"
CATEGORIES = {"cuisine": "Cuisine péruvienne", "boissons": "Boissons", "histoire": "Histoire et civilisations",
              "geographie": "Géographie et voyage", "culture": "Culture, fêtes et traditions",
              "langue": "Langue et expressions", "insolite": "Insolite et curiosités",
              "degustation": "Dégustation et expérience", "interaction": "Interaction et quiz"}
ANGLES = ROOT / "content" / "angles.json"
PUBLISHED = ROOT / "content" / "published.json"

# Réglages éditoriaux : config/content-pillars.json (piliers, parts visées, délais).
_PCFG = json.loads(PILLARS.read_text(encoding="utf-8"))
PILLAR_OF_CATEGORY = {c: p["id"] for p in _PCFG["pillars"] for c in p["categories"]}
TARGET_SHARE = {p["id"]: p["target_share"] for p in _PCFG["pillars"]}  # par pilier
MAX_SAME_PILLAR_IN_A_ROW = _PCFG["rules"]["max_same_pillar_in_a_row"]
THEME_COOLDOWN = _PCFG["rules"]["theme_cooldown_posts"]
ANGLE_COOLDOWN = _PCFG["rules"]["angle_type_cooldown_posts"]
REQUIRED_KEYS = {"id", "categorie", "sous_categorie", "theme", "sujet", "angle", "type_angle", "format",
                 "difficulte", "tournage_requis", "scores", "utilisations", "derniere_utilisation"}
SCORE_KEYS = ("recherche", "curiosite", "visuel", "commentaire", "partage", "originalite", "pertinence")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def ideas() -> dict:
    return load(IDEAS)


def _legacy(i: dict) -> dict:
    """Vue d'une idée avec les noms de champs utilisés par la sélection."""
    return {"id": i["id"], "categorie": i["category"], "pilier": i["pillar"], "sous_categorie": i["sub_category"],
            "theme": i["theme"], "sujet": i["subject"], "angle": i["title"], "type_angle": i["angle_type"],
            "format": i["format"], "difficulte": {"easy": 1, "medium": 2, "hard": 3}[i["difficulty"]],
            "tournage_requis": i["filming_required"], "scores": i["scores_10"],
            "score_total": sum(i["scores_10"].values()), "utilisations": i["usage"],
            "derniere_utilisation": i["last_used"], "status": i["status"]}


def topics() -> dict:
    """Idées de content/ideas.json, au format attendu par pick() et combine()."""
    return {"categories": CATEGORIES, "topics": [_legacy(i) for i in ideas()["ideas"]]}


def angles() -> dict:
    return load(ANGLES)


def timeline() -> list[dict]:
    """Publications produites, dans l'ordre du fil."""
    pubs = load(PUBLISHED)["publications"] if PUBLISHED.exists() else []
    return sorted(pubs, key=lambda p: (p["date"], p["day"]))


def pillar_of(entry: dict) -> str | None:
    """Pilier d'une publication ou d'une idée (déduit de la catégorie s'il manque)."""
    return entry.get("pillar") or entry.get("pilier") or PILLAR_OF_CATEGORY.get(
        entry.get("bank_category") or entry.get("categorie") or entry.get("category"))


def idea_by_id(tid: str) -> dict | None:
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

def rotation_ok(pillar: str, previous: list[str]) -> bool:
    """Jamais plus de MAX_SAME_PILLAR_IN_A_ROW publications de suite dans le même pilier."""
    tail = previous[-MAX_SAME_PILLAR_IN_A_ROW:]
    return not (len(tail) == MAX_SAME_PILLAR_IN_A_ROW and all(c == pillar for c in tail))


def used_combos(pubs: list[dict]) -> set[tuple[str, str]]:
    return {(p.get("theme"), p.get("type_angle")) for p in pubs if p.get("theme")}


def rotation_problems(post: dict, pubs: list[dict]) -> list[str]:
    """Rotation des piliers (les autres répétitions : content/repetition.py)."""
    before = [p for p in pubs if (p["date"], p["day"]) < (post["date"], post["day"])]
    pillar = pillar_of(post)
    if pillar and not rotation_ok(pillar, [pillar_of(p) for p in before]):
        return [f"{MAX_SAME_PILLAR_IN_A_ROW + 1}e publication de suite dans le pilier « {pillar} »"]
    return []


# ---------------------------------------------------------------- sélection

def pick(n: int = 5, fmt: str | None = None, category: str | None = None, filming: bool = False) -> list[dict]:
    pubs = timeline()
    cats = [pillar_of(p) for p in pubs]
    counts = Counter(c for c in cats if c)
    total = max(1, len(pubs))
    combos = used_combos(pubs)
    used_ids = {p.get("idea_id") for p in pubs}
    recent_themes = [p.get("theme") for p in pubs[-THEME_COOLDOWN:]]
    recent_angles = [p.get("type_angle") for p in pubs[-ANGLE_COOLDOWN:]]
    last_fmt = pubs[-1]["format"] if pubs else None
    themes_ever = {p.get("theme") for p in pubs}
    for p in pubs:
        p.setdefault("pillar", pillar_of(p))
    cat_bias = performance_bias(pubs, "pillar")
    angle_bias = performance_bias(pubs, "type_angle")

    ranked = []
    for t in topics()["topics"]:
        pil = t["pilier"]
        if fmt and t["format"] != fmt and not (fmt == "video" and t["format"] == "quiz"):
            continue
        if category and category not in (t["categorie"], pil):
            continue
        if t["id"] in used_ids or (t["theme"], t["type_angle"]) in combos:
            continue
        if not rotation_ok(pil, cats) or t["theme"] in recent_themes:
            continue
        why = []
        score = t["score_total"] / 70 * 100
        deficit = TARGET_SHARE.get(pil, 0.1) - counts[pil] / total
        score += deficit * 60
        if deficit > 0.03:
            why.append("pilier sous-représenté")
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
        if pil in cat_bias:
            score += 8 * cat_bias[pil]
            why.append(f"engagement pilier {cat_bias[pil]:+.0%}")
        if t["type_angle"] in angle_bias:
            score += 5 * angle_bias[t["type_angle"]]
        ranked.append({**t, "selection": round(score, 1), "raisons": why})
    ranked.sort(key=lambda t: -t["selection"])
    if category:
        return ranked[:n]
    # liste variée : au plus 2 idées par pilier, et jamais deux fois le même thème
    out, per_pil, seen = [], Counter(), set()
    for t in ranked:
        if per_pil[t["pilier"]] < 2 and t["theme"] not in seen:
            out.append(t)
            per_pil[t["pilier"]] += 1
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
    counts = Counter(pillar_of(p) for p in pubs)
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
            deficit = TARGET_SHARE.get(ref["pilier"], 0.1) - counts[ref["pilier"]] / total
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


def next_idea_id() -> str:
    return f"{max(int(t['id']) for t in topics()['topics']) + 1:03d}"


# ---------------------------------------------------------------- suivi

def mark_used(idea_id: str | None, day: int, date: str, post: dict) -> None:
    """Note l'utilisation d'une idée ; elle n'est jamais supprimée, son statut passe à « used »."""
    if not idea_id:
        return
    data = ideas()
    for i in data["ideas"]:
        if i["id"] == idea_id:
            i["usage"] = [u for u in i["usage"] if u["day"] != day] + [
                {"day": day, "date": date, "type_angle": post.get("type_angle"), "format": post["format"]}]
            i["last_used"] = max(u["date"] for u in i["usage"])
            i["status"] = "used"
    save(IDEAS, data)


def report() -> dict:
    data = topics()
    pubs = timeline()
    tp = data["topics"]
    counts = Counter(pillar_of(p) for p in pubs)
    total = max(1, len(pubs))
    unused = [t for t in tp if not t["utilisations"]]
    cats = {}
    for pil in _PCFG["pillars"]:
        c = pil["id"]
        cats[c] = {"nom": f"{pil['emoji']} {pil['name']}", "banque": sum(t["pilier"] == c for t in tp),
                   "restantes": sum(t["pilier"] == c for t in unused),
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
    return {"idees": len(tp), "intentions_10_dernieres": dict(mix), "restantes": len(unused), "piliers": cats, "sous_representees": under,
            "angles_utilises": dict(Counter(p.get("type_angle") for p in pubs)),
            "formats_utilises": dict(Counter(p["format"] for p in pubs)),
            "a_regenerer": len(unused) < 40, "problemes": problems,
            "genere_le": dt.date.today().isoformat()}
