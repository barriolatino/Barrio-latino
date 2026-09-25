"""Configuration des fournisseurs : lit `.env` (jamais commité) puis l'environnement.

Aucune clé n'est écrite dans le code. Une variable d'environnement réelle
l'emporte toujours sur `.env`.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_cache: dict | None = None


def _load() -> dict:
    global _cache
    if _cache is None:
        _cache = {}
        f = ROOT / ".env"
        if f.exists():
            for line in f.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    _cache[k.strip()] = v.strip().strip('"').strip("'")
    return _cache


def get(key: str, default: str = "") -> str:
    return os.environ.get(key) or _load().get(key) or default


def require(key: str, provider: str) -> str:
    """Valeur obligatoire pour un fournisseur ; message clair si elle manque."""
    value = get(key)
    if not value:
        raise MissingConfig(f"{provider} : la variable {key} est vide. Renseigne-la dans .env (voir .env.example).")
    return value


def mock_enabled() -> bool:
    return get("MOCK", "0") == "1"


class MissingConfig(RuntimeError):
    pass
