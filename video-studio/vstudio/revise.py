"""Révisions en langage naturel → modifications explicites du plan de montage.

Le système ne « devine » pas : chaque phrase reconnue est traduite en changements
de paramètres listés et journalisés. Une demande non reconnue produit une erreur
qui liste les formulations prises en charge. Les versions précédentes de la
timeline sont conservées (timeline/v001.json, v002.json, …).

Deux types de révisions :
- globales (rythme, style, durée, musique, sous-titres, format) → nouveau plan ;
- locales (supprimer / ralentir / accélérer un plan c07) → copie de la timeline
  modifiée uniquement sur ce plan ; les autres segments sont réutilisés au rendu.
"""

from __future__ import annotations

import copy
import re
import unicodedata

from . import config, planner
from .errors import ConfigError
from .project import Project

PRESET_WORDS = {"tiktok": "tiktok", "reels": "reels", "reel": "reels", "instagram": "reels", "shorts": "shorts",
                "short": "shorts", "youtube": "youtube", "archive": "archive", "archivage": "archive",
                "formation": "formation", "interview": "interview"}
COLOR_WORDS = {"noir et blanc": "noir_et_blanc", "plus chaud": "chaud", "plus chaleureux": "chaud",
               "plus froid": "froid", "couleurs naturelles": "naturel", "plus naturel": "naturel",
               "plus commercial": "commercial", "documentaire": "documentaire"}
NUMBERS = {"une": 1, "un": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5}

EXAMPLES = [
    "Fais un montage plus dynamique.", "Supprime les longueurs.", "Garde davantage les réactions naturelles.",
    "Rends le début plus accrocheur.", "Fais une version plus cinématique.", "Réduis la musique sous les voix.",
    "Les sous-titres sont trop grands.", "Mets davantage en valeur le produit.", "Ralentis le plan c04.",
    "Supprime le plan c07.", "Fais une version de 30 secondes.", "Crée une version TikTok et une version YouTube.",
    "Fais trois propositions de montage différentes.", "Sans musique.", "Passe en noir et blanc.",
]


def _norm(text: str) -> str:
    t = text.lower().replace("’", "'")
    return re.sub(r"\s+", " ", t)


def _plain(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()


def parse(text: str, prof: dict, has_speech: bool) -> dict:
    """Renvoie {'settings': {...}, 'overrides': {...}, 'local': [...], 'variants': n, 'changes': [...]}"""
    t = _norm(text)
    p = _plain(t)
    out = {"settings": {}, "overrides": {}, "local": [], "variants": 0, "changes": []}
    ov = out["overrides"]

    def pace(f: float, label: str):
        for k in ("min_shot", "max_shot", "pause_max", "pause_keep"):
            ov[k] = round(ov.get(k, prof[k]) * f, 3)
        out["changes"].append(f"{label} : plans et pauses ×{f}")

    if re.search(r"plus (dynamique|rythme|rapide|nerveux)|accelere le rythme|plus de rythme", p):
        pace(0.75, "rythme plus soutenu")
    if re.search(r"plus (lent|calme|pose|contemplatif)|moins rapide|ralentis le rythme", p):
        pace(1.3, "rythme plus posé")
    if re.search(r"(supprime|enleve|retire|coupe) (les )?longueurs|plus serre|resserre|temps morts", p):
        ov["pause_max"] = round(ov.get("pause_max", prof["pause_max"]) * 0.6, 3)
        ov["pause_keep"] = round(ov.get("pause_keep", prof["pause_keep"]) * 0.7, 3)
        out["changes"].append(f"pauses > {ov['pause_max']} s ramenées à {ov['pause_keep']} s")
    if re.search(r"(garde|conserve|laisse).*(reaction|pause|respiration|silence|naturel)", p):
        ov["pause_max"] = round(ov.get("pause_max", prof["pause_max"]) * 1.5, 3)
        ov["pause_keep"] = round(ov.get("pause_keep", prof["pause_keep"]) * 1.6, 3)
        out["changes"].append(f"pauses et réactions mieux conservées (pauses gardées jusqu'à {ov['pause_max']} s)")
    if re.search(r"debut plus accrocheur|accroche|commence plus fort|hook", p):
        ov["hook"] = "teaser" if has_speech else "meilleur_plan"
        out["changes"].append(f"accroche : {ov['hook']} (à valider)")
    if re.search(r"cinematique|cinema|cinematographique", p):
        out["settings"]["profile"] = "cinematique"
        out["changes"].append("profil cinématique (plans longs, fondus discrets, étalonnage cinéma)")
    if re.search(r"(reduis|baisse|diminue|moins).*(musique).*(voix|parole)|musique.*(sous|derriere) (les )?voix", p):
        ov["duck_db"] = round(prof["duck_db"] - 6, 1)
        out["changes"].append(f"musique plus basse sous les voix (ducking {ov['duck_db']} dB)")
    elif re.search(r"musique.*(plus forte|plus fort|monte|plus presente)", p):
        ov["music_db"] = round(prof["music_db"] + 4, 1)
        out["changes"].append(f"musique plus présente ({ov['music_db']} dB)")
    elif re.search(r"musique.*(moins forte|plus basse|plus discrete)|baisse la musique", p):
        ov["music_db"] = round(prof["music_db"] - 4, 1)
        out["changes"].append(f"musique plus discrète ({ov['music_db']} dB)")
    if re.search(r"sans musique|enleve la musique|retire la musique|pas de musique", p):
        out["settings"]["music"] = ""
        out["changes"].append("musique retirée")
    if re.search(r"sous-titres? .*(trop grand|plus petit)|sous-titres? plus petits", p):
        out["settings"]["subtitle_scale_factor"] = 0.85
        out["changes"].append("sous-titres 15 % plus petits")
    if re.search(r"sous-titres? .*(trop petit|plus grand)|sous-titres? plus grands", p):
        out["settings"]["subtitle_scale_factor"] = 1.15
        out["changes"].append("sous-titres 15 % plus grands")
    if re.search(r"sans sous-titres?|(enleve|retire|supprime) (les )?sous-titres?", p):
        out["settings"]["captions"] = False
        out["changes"].append("sous-titres désactivés")
    elif re.search(r"(avec|ajoute|mets) (les |des )?sous-titres?", p):
        out["settings"]["captions"] = True
        out["changes"].append("sous-titres activés")
    m = re.search(r"(\d+)\s*(s\b|sec|secondes?)", p)
    m2 = re.search(r"(\d+)\s*(min|minutes?)\b", p)
    if m or m2:
        secs = int(m.group(1)) if m else int(m2.group(1)) * 60
        out["settings"]["target_duration"] = secs
        out["changes"].append(f"durée cible {secs} s")
    presets = []
    for w, name in PRESET_WORDS.items():
        if re.search(rf"\b{w}\b", p) and name not in presets:
            presets.append(name)
    if presets and re.search(r"version|format|export|cree|fais", p):
        out["settings"]["presets"] = presets
        out["changes"].append("formats : " + ", ".join(presets))
    for w, c in COLOR_WORDS.items():
        if w in p:
            ov["color"] = c
            out["changes"].append(f"couleur : {c}")
            break
    if re.search(r"(plus de |davantage |mets? .*en valeur ).*(produit|detail|plat)", p):
        ov["broll_cutaways"] = True
        ov["broll_max_cover"] = round(min(0.6, prof["broll_max_cover"] + 0.15), 2)
        out["changes"].append("davantage de plans d'illustration (détails/produit) sur la parole — approximation : "
                              "le système ne reconnaît pas le produit, il augmente la place des plans d'illustration")
    if re.search(r"sans fondu|coupes? franches?", p):
        ov["transition"] = "cut"
        out["changes"].append("transitions : coupes franches")
    elif re.search(r"fondus?|transitions? douces?", p):
        ov["transition"] = "fondu"
        out["changes"].append("transitions : fondus enchaînés discrets entre rushs")
    mv = re.search(r"(\d+|une|deux|trois|quatre|cinq) (propositions|versions|variantes)", p)
    if mv and not presets:
        n = int(mv.group(1)) if mv.group(1).isdigit() else NUMBERS[mv.group(1)]
        out["variants"] = max(1, min(5, n))
        out["changes"].append(f"{out['variants']} propositions de montage")
    for verb, action in (("supprime|enleve|retire|coupe", "drop"), ("ralentis|ralenti", "slow"),
                         ("accelere", "fast")):
        for mm in re.finditer(rf"({verb}) (le |la )?(plan|sequence|clip|passage) (c?\d+)", p):
            cid = mm.group(4)
            cid = cid if cid.startswith("c") else f"c{int(cid):02d}"
            out["local"].append((action, cid))
            out["changes"].append({"drop": "supprimer", "slow": "ralentir (×0,5)", "fast": "accélérer (×1,5)"}[action]
                                  + f" le plan {cid}")
    if re.search(r"ralentis|ralentir", p) and not out["local"] and "rythme plus posé" not in str(out["changes"]):
        raise ConfigError("Quelle séquence faut-il ralentir ?",
                          hint="Indiquez le numéro du plan (voir timeline/plan_vXXX.md), ex. : « Ralentis le plan c04 ».")
    if not out["changes"]:
        raise ConfigError("Demande non reconnue : « %s »." % text.strip(),
                          hint="Exemples pris en charge : " + " / ".join(EXAMPLES))
    return out


def apply(project: Project, text: str) -> dict:
    """Applique une révision et renvoie la description des changements + la nouvelle timeline."""
    from . import pipeline
    tl = project.load_timeline()
    prof = tl["params"]
    req = parse(text, prof, tl["brief"]["has_speech"])
    project.journal(f"Révision demandée : « {text} »")
    for c in req["changes"]:
        project.journal(f"    → {c}")
    s = project.settings
    if req["local"] and not (req["settings"] or req["overrides"]):
        new = copy.deepcopy(tl)
        ids = {c["id"] for c in new["clips"]}
        for action, cid in req["local"]:
            if cid not in ids:
                raise ConfigError(f"Plan {cid} introuvable dans la timeline v{tl['version']:03d}.",
                                  hint=f"Plans existants : {', '.join(sorted(ids))}.")
            for c in new["clips"]:
                if c["id"] != cid:
                    continue
                if action == "drop":
                    if c["kind"] == "parole":
                        new["flags"].append(f"plan parlé {cid} supprimé à la demande : vérifier que le sens est préservé")
                    new["clips"].remove(c)
                    break
                c["speed"] = 0.5 if action == "slow" else 1.5
                if c["kind"] == "parole":
                    new["flags"].append(f"vitesse de la parole modifiée sur {cid} : vérifier l'intelligibilité")
                    c["speed"] = 0.8 if action == "slow" else 1.25
        new["expected_duration"] = round(sum((c["out"] - c["in"]) / c.get("speed", 1) for c in new["clips"]), 3)
        new["decisions"] = tl["decisions"] + [f"Révision : {', '.join(map(str, req['changes']))}"]
        new["parent_version"] = tl["version"]
        project.save_timeline(new)
        planner.write_plan_md(project, new)
        project.state["steps"]["plan"]["key"] = new.get("plan_key", "")
        project.save()
        return {"changes": req["changes"], "timeline": new}
    # révisions globales → nouveau plan
    if "subtitle_scale_factor" in req["settings"]:
        s["subtitle_scale"] = round(float(s.get("subtitle_scale") or 1.0) * req["settings"].pop("subtitle_scale_factor"), 3)
    if "profile" in req["settings"]:
        s["profile"] = req["settings"].pop("profile")
        s["overrides"] = {}
    s.update(req["settings"])
    ov = dict(s.get("overrides") or {})
    ov.update(req["overrides"])
    if ov:
        config.editorial_profile(s.get("profile") or tl["profile"], ov)  # validation
    s["overrides"] = ov
    if not s.get("profile"):
        s["profile"] = tl["profile"]
    project.save()
    if req["variants"]:
        return {"changes": req["changes"], "variants": make_variants(project, req["variants"])}
    new = pipeline.step_plan(project, force=True)
    new["parent_version"] = tl["version"]
    for c in req["local"]:
        new["flags"].append(f"révision locale ignorée car le plan a été recalculé : {c}")
    return {"changes": req["changes"], "timeline": new}


VARIANT_RECIPES = [
    ("équilibrée", {}),
    ("serrée et accrocheuse", {"pace": 0.75, "hook": True}),
    ("aérée et naturelle", {"pace": 1.35, "hook": False}),
    ("courte", {"duration_factor": 0.6}),
    ("illustrée", {"broll": True}),
]


def make_variants(project: Project, n: int) -> list[dict]:
    """Plusieurs propositions de montage à partir des mêmes rushs (chacune = une version)."""
    from . import pipeline
    base_overrides = dict(project.settings.get("overrides") or {})
    base_target = project.settings.get("target_duration") or 0
    tl0 = project.load_timeline()
    prof = config.editorial_profile(project.settings.get("profile") or tl0["profile"], base_overrides)
    out = []
    try:
        for name, r in VARIANT_RECIPES[:n]:
            ov = dict(base_overrides)
            if "pace" in r:
                for k in ("min_shot", "max_shot", "pause_max", "pause_keep"):
                    ov[k] = round(prof[k] * r["pace"], 3)
            if "hook" in r:
                ov["hook"] = ("teaser" if tl0["brief"]["has_speech"] else "meilleur_plan") if r["hook"] else "aucun"
            if r.get("broll"):
                ov["broll_cutaways"] = True
                ov["broll_max_cover"] = 0.5
            project.settings["overrides"] = ov
            project.settings["target_duration"] = round(tl0["expected_duration"] * r["duration_factor"]) \
                if r.get("duration_factor") else base_target
            tl = pipeline.step_plan(project, force=True)
            tl["variant"] = name
            from .project import atomic_write_text
            import json
            atomic_write_text(project.path(project.state["timeline_versions"][-1]),
                              json.dumps(tl, indent=2, ensure_ascii=False))
            out.append({"variant": name, "version": tl["version"], "duration": tl["expected_duration"],
                        "clips": len(tl["clips"])})
            project.journal(f"    proposition « {name} » : v{tl['version']:03d}, {tl['expected_duration']:.1f} s")
    finally:
        project.settings["overrides"] = base_overrides
        project.settings["target_duration"] = base_target
        project.save()
    return out
