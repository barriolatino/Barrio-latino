#!/usr/bin/env python3
"""Tests de structure de la Content Factory (Phase 1).

Vérifie que l'architecture, la configuration, la base de contenu, les commandes
et la documentation sont cohérentes. Lancement : `npm test` ou `python3 tools/check.py`.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
COMMANDS = ROOT / ".claude" / "commands"  # autonome : suit le projet s'il change de dépôt

results: list[tuple[str, bool, str]] = []


def test(name):
    def deco(fn):
        try:
            detail = fn() or ""
            results.append((name, True, detail))
        except AssertionError as e:
            results.append((name, False, str(e)))
        except Exception as e:  # une exception inattendue est un échec, pas un crash
            results.append((name, False, f"{type(e).__name__}: {e}"))
        return fn
    return deco


def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


@test("architecture")
def _():
    dirs = ["config", "content", "research", "posts", "assets/images", "assets/videos", "assets/audio",
            "assets/music", "assets/fonts", "templates/video", "templates/carousel", "templates/cover",
            "tools/research", "tools/content", "tools/images", "tools/voice", "tools/subtitles", "tools/video",
            "tools/carousel", "tools/quality-control", "output", "analytics"]
    files = ["CLAUDE.md", "README.md", ".env.example", ".gitignore", "package.json", "analytics/metrics.csv",
             "analytics/README.md"]
    missing = [d for d in dirs if not (ROOT / d).is_dir()] + [f for f in files if not (ROOT / f).is_file()]
    assert not missing, f"manquants : {missing}"
    return f"{len(dirs)} dossiers, {len(files)} fichiers"


@test("config")
def _():
    names = ["brand", "content-pillars", "video-style", "carousel-style", "source-policy", "production"]
    cfg = {n: load(f"config/{n}.json") for n in names}
    b = cfg["brand"]
    assert b["name"] == "Tio Clem" and b["username"] == "@tioclem15" and b["language"] == "fr"
    assert {"tone", "avoid", "positioning", "audience"} <= b.keys()
    v = cfg["video-style"]
    assert v["resolution"] == {"width": 1080, "height": 1920} and v["fps"] == 30
    assert v["codec"]["video"] == "libx264" and v["codec"]["audio"] == "aac"
    assert v["duration"]["min_s"] == 20 and v["duration"]["max_s"] == 45
    assert v["music"]["mode"] == "none", "la musique automatique doit rester désactivée"
    assert cfg["production"]["auto_publish"] is False, "auto_publish doit rester à false"
    assert cfg["production"]["hashtags"]["min"] == 5 and cfg["production"]["hashtags"]["max"] == 8
    sp = cfg["source-policy"]
    assert [p["rank"] for p in sp["priority"]] == list(range(1, len(sp["priority"]) + 1))
    assert {"source", "URL"} <= set(sp["rules"]["never_invent"])
    return "6 fichiers valides"


@test("piliers")
def _():
    p = load("config/content-pillars.json")["pillars"]
    assert len(p) == 8, f"{len(p)} piliers au lieu de 8"
    assert len({x["id"] for x in p}) == 8
    total = round(sum(x["target_share"] for x in p), 6)
    assert total == 1, f"somme des parts = {total}"
    cats = [c for x in p for c in x["categories"]]
    assert len(cats) == len(set(cats)), "une catégorie est rattachée à deux piliers"
    return ", ".join(f"{x['emoji']} {x['name']}" for x in p)


@test("idees")
def _():
    ideas = load("content/ideas.json")["ideas"]
    pillars = {x["id"] for x in load("config/content-pillars.json")["pillars"]}
    cats = {c for x in load("config/content-pillars.json")["pillars"] for c in x["categories"]}
    themes = {t["id"]: t for t in load("content/topics.json")["topics"]}
    angle_types = {a["id"] for a in load("content/angles.json")["angles"]}
    required = {"id", "title", "category", "pillar", "format", "difficulty", "visual_potential",
                "educational_potential", "conversation_potential", "originality", "last_used", "status"}
    assert len(ideas) >= 200, f"{len(ideas)} idées"
    ids = [i["id"] for i in ideas]
    assert len(ids) == len(set(ids)), "identifiants en double"
    errs = []
    for i in ideas:
        if required - i.keys():
            errs.append(f"{i['id']} : champs manquants {sorted(required - i.keys())}")
            continue
        if i["pillar"] not in pillars or i["category"] not in cats:
            errs.append(f"{i['id']} : pilier ou catégorie inconnus")
        if i["format"] not in ("video", "carrousel", "quiz") or i["difficulty"] not in ("easy", "medium", "hard"):
            errs.append(f"{i['id']} : format ou difficulté invalides")
        for k in ("visual_potential", "educational_potential", "conversation_potential", "originality"):
            if not 1 <= i[k] <= 5:
                errs.append(f"{i['id']} : {k} hors 1–5")
        if i["status"] not in ("available", "used") or (i["status"] == "used") != bool(i.get("usage")):
            errs.append(f"{i['id']} : statut incohérent avec l'historique")
        if i.get("theme") not in themes or i["id"] not in themes[i["theme"]]["idea_ids"]:
            errs.append(f"{i['id']} : thème absent de topics.json")
        if i.get("angle_type") not in angle_types:
            errs.append(f"{i['id']} : type d'angle inconnu")
    assert not errs, "; ".join(errs[:5])
    listed = {x for t in themes.values() for x in t["idea_ids"]}
    assert listed == set(ids), "topics.json référence des idées inexistantes ou en oublie"
    used = sum(i["status"] == "used" for i in ideas)
    return f"{len(ideas)} idées ({used} utilisées), {len(themes)} thèmes"


@test("calendrier")
def _():
    cal = load("content/calendar.json")["days"]
    ids = {i["id"] for i in load("content/ideas.json")["ideas"]}
    assert len(cal) == 30, f"{len(cal)} jours"
    dates = [dt.date.fromisoformat(d["date"]) for d in cal]
    assert all((b - a).days == 1 for a, b in zip(dates, dates[1:])), "dates non consécutives"
    bad = [d["day"] for d in cal if d.get("idea_id") not in ids]
    assert not bad, f"jours sans idée valide : {bad}"
    pillar_of = {c: p["id"] for p in load("config/content-pillars.json")["pillars"] for c in p["categories"]}
    pils = [pillar_of[d["bank_category"]] for d in cal]
    triple = [i + 1 for i in range(2, len(pils)) if pils[i] == pils[i - 1] == pils[i - 2]]
    assert not triple, f"3 jours de suite dans le même pilier : {triple}"
    return "30 jours, tous reliés à une idée, rotation des piliers respectée"


@test("historique")
def _():
    pubs = load("content/published.json")["publications"]
    ids = {i["id"] for i in load("content/ideas.json")["ideas"]}
    statuses = set(load("config/production.json")["statuses"])
    errs = [p["day"] for p in pubs if p.get("idea_id") not in ids or p["status"] not in statuses]
    assert not errs, f"entrées invalides : jours {errs}"
    for p in pubs:
        post = load(f"content/posts/day-{p['day']:02d}.json")
        assert post.get("idea_id") == p["idea_id"], f"jour {p['day']} : idea_id différent du post"
    return f"{len(pubs)} publications cohérentes"


@test("commandes")
def _():
    needed = ["create", "create-day", "daily", "batch", "research", "idea", "review", "calendar", "export", "month"]
    missing = [c for c in needed if not (COMMANDS / f"{c}.md").is_file()]
    assert not missing, f"commandes manquantes : {missing}"
    broken = []
    for f in sorted(COMMANDS.glob("*.md")):
        text = f.read_text(encoding="utf-8")
        assert text.startswith("---\n") and "description:" in text.split("---")[1], f"{f.name} : en-tête invalide"
        if "tioclem/" in text or "tio-clem/" in text:
            broken.append(f"{f.name} : chemin préfixé par le dossier du projet")
        for path in re.findall(r"`((?:tools|content|config|research|templates|assets|analytics|posts|export)/[^`\s]+|PLAYBOOK\.md|CLAUDE\.md|\.claude/commands/[^`\s]+)`", text):
            # chemins génériques, ou fichiers créés par la commande elle-même (export)
            if any(ch in path for ch in "<*") or "NN" in path or path.startswith("export/"):
                continue
            if not (ROOT / path).exists():
                broken.append(f"{f.name} → {path}")
    assert not broken, "; ".join(broken)
    return f"{len(list(COMMANDS.glob('*.md')))} commandes, chemins valides"


@test("env_et_secrets")
def _():
    env = (ROOT / ".env.example").read_text(encoding="utf-8")
    for var in ("MOCK", "TTS_PROVIDER", "IMAGE_PROVIDER", "OPENAI_API_KEY", "ELEVENLABS_API_KEY"):
        assert re.search(rf"^{var}=", env, re.M), f"{var} absent de .env.example"
    filled = re.findall(r"^([A-Z_]*(?:KEY|TOKEN|SECRET)[A-Z_]*)=(\S+)", env, re.M)
    assert not filled, f"valeurs de clés dans .env.example : {[k for k, _ in filled]}"
    assert re.search(r"^\.env$", (ROOT / ".gitignore").read_text(), re.M), ".env non ignoré par git"
    pattern = re.compile(r"(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xi-api-key\s*[:=]\s*\S{10,})")
    leaks = [str(p.relative_to(ROOT)) for p in ROOT.rglob("*")
             if p.is_file() and p.suffix in {".py", ".json", ".md", ".sh", ".txt", ".example"}
             and pattern.search(p.read_text(encoding="utf-8", errors="ignore"))]
    assert not leaks, f"secret possible dans : {leaks}"
    return "aucune clé dans le code ni dans .env.example"


@test("package_json")
def _():
    pkg = load("package.json")
    assert pkg["private"] is True and pkg["scripts"]["test"].startswith("python3 tools/check.py")
    for name, cmd in pkg["scripts"].items():
        for f in re.findall(r"(tools/\S+\.py|\S+\.sh)", cmd):
            assert (ROOT / f).exists(), f"script {name} : {f} introuvable"
    return f"{len(pkg['scripts'])} scripts"


@test("moteur")
def _():
    sys.path.insert(0, str(ROOT / "tools"))
    from content import selection as bank
    import factory
    import render  # noqa: F401
    assert bank.pick(3), "aucune idée proposée"
    nxt = factory.next_day()
    assert nxt is None or 1 <= nxt <= 30
    r = bank.report()
    assert not r["problemes"], r["problemes"][:3]
    return f"modules importés, prochain jour du calendrier : {nxt}"


if __name__ == "__main__":
    width = max(len(n) for n, _, _ in results)
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name:<{width}}  {detail}")
    failed = [n for n, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} tests réussis")
    sys.exit(1 if failed else 0)
