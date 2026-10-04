"""Chargement des presets (export, profils éditoriaux, couleur, sous-titres)."""

from __future__ import annotations

import os
import tomllib
from pathlib import Path

from .errors import ConfigError

STUDIO_ROOT = Path(__file__).resolve().parent.parent
PRESETS_DIR = STUDIO_ROOT / "presets"


def workspace() -> Path:
    """Racine des dossiers de travail (input/, projects/, exports/).

    Par défaut le dossier video-studio/ ; VSTUDIO_HOME permet de la déplacer
    (utilisé par les tests pour ne pas toucher aux vrais projets).
    """
    return Path(os.environ.get("VSTUDIO_HOME", STUDIO_ROOT)).resolve()


def _load(name: str) -> dict:
    path = PRESETS_DIR / name
    with open(path, "rb") as f:
        return tomllib.load(f)


def _pick(table: dict, key: str, kind: str) -> dict:
    if key not in table:
        choices = ", ".join(k for k in table if k != "defaut")
        raise ConfigError(f"{kind} inconnu : « {key} ».", hint=f"Valeurs possibles : {choices}.")
    return dict(table[key])


def export_presets() -> dict:
    presets = _load("export.toml")
    extra = os.environ.get("VSTUDIO_EXTRA_PRESETS")  # presets supplémentaires (tests, usages locaux)
    if extra and Path(extra).exists():
        with open(extra, "rb") as f:
            presets.update(tomllib.load(f))
    return presets


def export_preset(name: str) -> dict:
    p = _pick(export_presets(), name, "Format d'export")
    p["name"] = name
    return p


def color_profiles() -> dict:
    return _load("color.toml")


def color_profile(name: str) -> dict:
    p = _pick(color_profiles(), name, "Profil couleur")
    p["name"] = name
    return p


def subtitle_styles() -> dict:
    return _load("subtitles.toml")


def subtitle_style(name: str) -> dict:
    p = _pick(subtitle_styles(), name, "Style de sous-titres")
    p["name"] = name
    return p


def editorial_profiles() -> dict:
    table = _load("profiles.toml")
    custom_dir = PRESETS_DIR / "profiles"
    if custom_dir.is_dir():
        for f in sorted(custom_dir.glob("*.toml")):
            with open(f, "rb") as fh:
                data = tomllib.load(fh)
            if "profil" in data:
                table[f.stem] = data["profil"]
    return table


def editorial_profile(name: str, overrides: dict | None = None) -> dict:
    table = editorial_profiles()
    chain: list[dict] = []
    current, seen = name, set()
    while current and current != "defaut":
        if current in seen:
            raise ConfigError(f"Héritage circulaire dans le profil « {name} ».")
        seen.add(current)
        p = _pick(table, current, "Profil de montage")
        chain.append(p)
        current = p.get("extends", "")
    result = dict(table["defaut"])
    for p in reversed(chain):
        result.update({k: v for k, v in p.items() if k != "extends"})
    result["name"] = name
    if overrides:
        unknown = [k for k in overrides if k not in result]
        if unknown:
            raise ConfigError(f"Paramètre(s) de profil inconnu(s) : {', '.join(unknown)}.")
        result.update(overrides)
    return result


def save_custom_profile(name: str, base: str, overrides: dict) -> Path:
    """Enregistre un profil personnalisé (héritant de « base ») dans presets/profiles/."""
    editorial_profile(base, overrides)  # valide
    path = PRESETS_DIR / "profiles" / f"{name}.toml"
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["[profil]", f'extends = "{base}"', f'label = "{name}"']
    for k, v in overrides.items():
        if isinstance(v, bool):
            lines.append(f"{k} = {'true' if v else 'false'}")
        elif isinstance(v, (int, float)):
            lines.append(f"{k} = {v}")
        else:
            lines.append(f'{k} = "{v}"')
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path
