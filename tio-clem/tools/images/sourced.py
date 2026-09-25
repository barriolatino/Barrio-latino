"""Images sourcées (Mode A) : registre avec source, URL, auteur et licence.

Tio Clem recadre les images et y pose du texte : c'est une adaptation, et le compte
peut être monétisé. On n'accepte donc que des licences qui autorisent l'usage
commercial et la modification.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCED = ROOT / "assets" / "images" / "sourced"
MANIFEST = SOURCED / "manifest.json"

LICENSES = {
    # licence : attribution obligatoire ?
    "own": False,               # photo prise par Tio Clem
    "CC0": False,
    "public-domain": False,
    "CC BY 4.0": True,
    "CC BY-SA 4.0": True,
    "CC BY 3.0": True,
    "CC BY-SA 3.0": True,
    "CC BY 2.0": True,
    "CC BY-SA 2.0": True,
    "Unsplash License": False,
    "Pexels License": False,
}
REFUSED_HINT = "NC (pas d'usage commercial) et ND (pas de modification) sont refusées."


def load() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"images": []}


def check(entry: dict) -> list[str]:
    errs = []
    if entry.get("license") not in LICENSES:
        errs.append(f"licence « {entry.get('license')} » non acceptée ({', '.join(LICENSES)} ; {REFUSED_HINT})")
    if entry.get("license") != "own":
        for k in ("source", "url", "author", "license_url"):
            if not entry.get(k):
                errs.append(f"« {k} » manquant")
        if entry.get("url") and not entry["url"].startswith(("http://", "https://")):
            errs.append("URL invalide")
    if not (ROOT / entry.get("file", "")).is_file():
        errs.append(f"fichier introuvable : {entry.get('file')}")
    return errs


def register(file: str, license: str, day: int, unit: str, source: str = "", url: str = "", author: str = "",
             license_url: str = "", note: str = "") -> dict:
    """Ajoute une image au registre après vérification. Refuse toute entrée incomplète."""
    entry = {"file": file, "day": day, "unit": unit, "license": license, "source": source, "url": url,
             "author": author, "license_url": license_url, "attribution_required": LICENSES.get(license, True),
             "note": note, "registered": dt.date.today().isoformat()}
    errs = check(entry)
    if errs:
        raise ValueError("; ".join(errs))
    data = load()
    data["images"] = [i for i in data["images"] if not (i["day"] == day and i["unit"] == unit)] + [entry]
    SOURCED.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return entry


def find(day: int, unit: str) -> dict | None:
    return next((i for i in load()["images"] if i["day"] == day and i["unit"] == unit), None)


def credit(entry: dict) -> str:
    return f"{entry['author']} — {entry['source']} — {entry['license']} ({entry['url']})"
