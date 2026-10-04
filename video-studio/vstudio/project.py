"""Projet de montage : dossier, état persistant, journal, étapes et reprise.

Arborescence d'un projet (projects/<slug>/) :
    project.json        état complet (paramètres, rushs, étapes, versions)
    journal.log         journal lisible de toutes les opérations
    analysis/           analyses par rush (JSON), vignettes, rapport
    transcripts/        transcriptions par rush (JSON modifiable)
    timeline/           versions successives du plan de montage (v001.json, ...)
    cache/              segments rendus (réutilisés à la reprise)
    subtitles/          SRT / VTT / ASS
    previews/           prévisualisations
    exports/            exports finaux + rapports de contrôle qualité
    qc/                 images extraites et mesures du contrôle qualité
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import os
import re
import sys
import unicodedata
from pathlib import Path

from .config import workspace
from .errors import ProjectError

SCHEMA = 1
SUBDIRS = ["analysis", "transcripts", "timeline", "cache", "subtitles", "previews", "exports", "qc"]


def now() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "projet"


def stable_hash(obj) -> str:
    data = json.dumps(obj, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha1(data.encode()).hexdigest()[:12]


def atomic_write_text(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def projects_dir() -> Path:
    d = workspace() / "projects"
    d.mkdir(parents=True, exist_ok=True)
    return d


class Project:
    def __init__(self, root: Path, state: dict):
        self.root = root
        self.state = state
        self.log = _make_logger(root)

    # --- création / ouverture -------------------------------------------------
    @classmethod
    def create(cls, name: str, settings: dict | None = None, exist_ok: bool = False) -> "Project":
        slug = slugify(name)
        root = projects_dir() / slug
        if (root / "project.json").exists():
            if not exist_ok:
                raise ProjectError(f"Le projet « {slug} » existe déjà.",
                                   hint="Utilisez « project open » pour le reprendre, ou choisissez un autre nom.")
            proj = cls.open(slug)
            if settings:
                proj.state["settings"].update(settings)
                proj.save()
            return proj
        root.mkdir(parents=True, exist_ok=True)
        for d in SUBDIRS:
            (root / d).mkdir(exist_ok=True)
        state = {
            "schema": SCHEMA,
            "name": name,
            "slug": slug,
            "created": now(),
            "updated": now(),
            "settings": {
                "profile": "",
                "presets": [],
                "target_duration": 0,
                "lang": "auto",
                "title": "",
                "end_text": "",
                "speakers": {},
                "music": "",
                "captions": None,
                "subtitle_scale": 1.0,
                "overrides": {},
                **(settings or {}),
            },
            "rushes": [],
            "steps": {},
            "timeline_versions": [],
            "renders": [],
            "approval": {"status": "non_validé", "by": "", "at": "", "note": ""},
        }
        proj = cls(root, state)
        proj.save()
        proj.journal(f"Projet créé : {name}")
        return proj

    @classmethod
    def open(cls, name_or_path: str | Path) -> "Project":
        p = Path(name_or_path)
        candidates = [p, projects_dir() / str(name_or_path), projects_dir() / slugify(str(name_or_path))]
        for c in candidates:
            if (c / "project.json").exists():
                state = json.loads((c / "project.json").read_text(encoding="utf-8"))
                for d in SUBDIRS:
                    (c / d).mkdir(exist_ok=True)
                return cls(c.resolve(), state)
        existing = ", ".join(sorted(x.name for x in projects_dir().iterdir() if (x / "project.json").exists()))
        raise ProjectError(f"Projet introuvable : {name_or_path}",
                           hint=f"Projets existants : {existing or 'aucun'}.")

    @staticmethod
    def list_all() -> list[dict]:
        out = []
        for d in sorted(projects_dir().iterdir()):
            f = d / "project.json"
            if f.exists():
                s = json.loads(f.read_text(encoding="utf-8"))
                out.append({"slug": s["slug"], "name": s["name"], "updated": s["updated"],
                            "rushes": len(s["rushes"]), "steps": {k: v["status"] for k, v in s["steps"].items()},
                            "approval": s.get("approval", {}).get("status")})
        return out

    # --- persistance ----------------------------------------------------------
    def save(self) -> None:
        self.state["updated"] = now()
        atomic_write_text(self.root / "project.json", json.dumps(self.state, indent=2, ensure_ascii=False))

    def journal(self, msg: str, level: int = logging.INFO) -> None:
        self.log.log(level, msg)

    # --- étapes et reprise ----------------------------------------------------
    def step_key_matches(self, step: str, key: str) -> bool:
        s = self.state["steps"].get(step)
        return bool(s and s.get("status") == "terminé" and s.get("key") == key)

    def mark_step(self, step: str, status: str, key: str = "", detail: str = "") -> None:
        self.state["steps"][step] = {"status": status, "at": now(), "key": key, "detail": detail}
        self.save()

    # --- accès pratiques ------------------------------------------------------
    @property
    def settings(self) -> dict:
        return self.state["settings"]

    def path(self, *parts: str) -> Path:
        return self.root.joinpath(*parts)

    def rush(self, rush_id: str) -> dict:
        for r in self.state["rushes"]:
            if r["id"] == rush_id:
                return r
        raise ProjectError(f"Rush inconnu : {rush_id}")

    def usable_rushes(self) -> list[dict]:
        return [r for r in self.state["rushes"] if r.get("status") == "ok"]

    def current_timeline_path(self) -> Path | None:
        v = self.state["timeline_versions"]
        return self.path(v[-1]) if v else None

    def load_timeline(self, version: int | None = None) -> dict:
        versions = self.state["timeline_versions"]
        if not versions:
            raise ProjectError("Aucun plan de montage pour ce projet.",
                               hint="Lancez d'abord l'étape « edit » (ou « run »).")
        rel = versions[-1] if version is None else f"timeline/v{version:03d}.json"
        p = self.path(rel)
        if not p.exists():
            raise ProjectError(f"Version de timeline introuvable : {rel}")
        return json.loads(p.read_text(encoding="utf-8"))

    def save_timeline(self, timeline: dict) -> Path:
        n = len(self.state["timeline_versions"]) + 1
        timeline["version"] = n
        timeline["created"] = now()
        rel = f"timeline/v{n:03d}.json"
        atomic_write_text(self.path(rel), json.dumps(timeline, indent=2, ensure_ascii=False))
        self.state["timeline_versions"].append(rel)
        self.save()
        return self.path(rel)


def _make_logger(root: Path) -> logging.Logger:
    logger = logging.getLogger(f"vstudio.{root}")
    if logger.handlers:
        return logger
    logger.setLevel(logging.DEBUG)
    logger.propagate = False
    fh = logging.FileHandler(root / "journal.log", encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-7s %(message)s", "%Y-%m-%d %H:%M:%S"))
    logger.addHandler(fh)
    if os.environ.get("VSTUDIO_QUIET") != "1":
        sh = logging.StreamHandler(sys.stdout)
        sh.setLevel(logging.INFO)
        sh.setFormatter(logging.Formatter("  %(message)s"))
        logger.addHandler(sh)
    return logger
