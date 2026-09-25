"""Validation des fiches de recherche selon config/source-policy.json.

La recherche elle-même est faite par Claude Code (WebSearch, Firecrawl) : ce module
ne va pas sur le web. Il vérifie que la fiche respecte la politique de sources et
produit le sources.json de chaque publication.
"""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
POLICY = json.loads((ROOT / "config" / "source-policy.json").read_text(encoding="utf-8"))
RULES = POLICY["rules"]
MULTI_SOURCE_CATEGORIES = {"histoire", "culture"}  # « plusieurs sources lorsque nécessaire »


def read_status(src: dict) -> str:
    """« complet » (page lue) ou « extrait » (vue seulement via un moteur de recherche)."""
    if src.get("lu") in ("complet", "extrait"):
        return src["lu"]
    note = (src.get("note") or "").lower()
    return "extrait" if ("extrait" in note or "résultat de recherche" in note) else "complet"


def domain(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def used_fact_ids(research: dict, post: dict | None = None) -> set[str]:
    if post is not None:
        units = post.get("scenes") or post.get("slides") or []
        return {f for u in units for f in u.get("facts", [])}
    return {f["id"] for f in research.get("faits", []) if f.get("utilise_dans")}


def validate(research: dict, post: dict | None = None, category: str | None = None) -> dict:
    errors, warnings = [], []
    for key in ("sujet", "slug", "sources", "faits"):
        if key not in research:
            errors.append(f"champ « {key} » manquant")
    if errors:
        return {"errors": errors, "warnings": warnings, "sources_used": []}

    sources = {}
    for s in research["sources"]:
        sid = s.get("id", "?")
        if sid in sources:
            errors.append(f"{sid} : identifiant de source en double")
        sources[sid] = s
        for k in ("titre", "url", "editeur"):
            if not s.get(k):
                errors.append(f"{sid} : « {k} » manquant")
        url = s.get("url", "")
        if not url.startswith(("http://", "https://")):
            errors.append(f"{sid} : URL invalide « {url} »")
            continue
        d = domain(url)
        if any(bad in d for bad in POLICY["forbidden_domains"]):
            errors.append(f"{sid} : domaine interdit comme source factuelle ({d})")
        for nc, why in POLICY["not_citable_domains"].items():
            if nc in d:
                errors.append(f"{sid} : {nc} ne se cite pas ({why})")
        for wd, why in POLICY["warn_domains"].items():
            if wd in d:
                warnings.append(f"{sid} : {why}")
        if not s.get("date_publication"):
            warnings.append(f"{sid} : date de publication absente")

    facts = {}
    for f in research["faits"]:
        fid = f.get("id", "?")
        if fid in facts:
            errors.append(f"{fid} : identifiant de fait en double")
        facts[fid] = f
        if f.get("statut") not in RULES["fact_status"]:
            errors.append(f"{fid} : statut « {f.get('statut')} » inconnu")
        if f.get("confiance") not in RULES["confidence"]:
            errors.append(f"{fid} : confiance « {f.get('confiance')} » inconnue")
        unknown = [x for x in f.get("sources", []) if x not in sources]
        if not f.get("sources") or unknown:
            errors.append(f"{fid} : sources absentes ou inconnues {unknown}")

    used = used_fact_ids(research, post)
    missing = sorted(used - facts.keys())
    if missing:
        errors.append(f"faits utilisés mais absents de la recherche : {missing}")
    used_sources = set()
    for fid in sorted(used & facts.keys()):
        f = facts[fid]
        srcs = [sources[x] for x in f.get("sources", []) if x in sources]
        used_sources |= {x for x in f.get("sources", []) if x in sources}
        if srcs and all(read_status(s) == "extrait" for s in srcs):
            errors.append(f"{fid} : ne repose que sur des extraits de recherche (aucune page lue)")
        if f.get("confiance") == "basse" and not RULES["low_confidence_on_screen"]:
            errors.append(f"{fid} : confiance basse, interdit à l'écran")
        if category in MULTI_SOURCE_CATEGORIES and len(srcs) < 2:
            warnings.append(f"{fid} : une seule source pour un sujet {category}")
    if used and len(used_sources) < RULES["min_sources_per_post"]:
        errors.append(f"{len(used_sources)} source(s) pour la publication, minimum {RULES['min_sources_per_post']}")
    for e in research.get("informations_ecartees", []):
        if not e.get("raison"):
            errors.append(f"information écartée sans raison : « {e.get('information', '')[:40]} »")

    return {"errors": errors, "warnings": warnings,
            "sources_used": sources_json(research, used)}


def sources_json(research: dict, used: set[str]) -> list[dict]:
    """sources.json au format V2 : [{title, url, publisher, date, used_for}]."""
    facts = {f["id"]: f for f in research.get("faits", [])}
    out = []
    for s in research.get("sources", []):
        uses = [fid for fid in sorted(used) if s["id"] in facts.get(fid, {}).get("sources", [])]
        if not uses:
            continue
        out.append({"title": s["titre"], "url": s["url"], "publisher": s["editeur"],
                    "date": s.get("date_publication", ""),
                    "used_for": " ; ".join(f"{fid} : {facts[fid]['fait'][:90]}" for fid in uses),
                    "read": read_status(s)})
    return out
