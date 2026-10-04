"""Tests de bout en bout via la ligne de commande : de l'import au MP4 final, puis vérification du fichier."""

import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

from conftest import EXTRA, ROOT, run_cli
from vstudio import ffmpeg
from vstudio.analysis.audio import activity_regions, frame_db


def test_bout_en_bout_tiktok(ws, media):
    """Import → analyse → plan → prévisualisation → export TikTok 1080×1920 → contrôle indépendant du fichier."""
    out = run_cli(["run", "e2e", "--input", str(media["demo_dir"]), "--lang", "en", "--preset", "tiktok",
                   "--music", str(media["music"]), "--music-provenance", "synthétisée (tests)",
                   "--title", "Riz aux légumes"], ws, timeout=900)
    assert "CONFORME" in out.stdout
    proj = ws / "projects" / "e2e"
    mp4 = proj / "exports" / "e2e_v001_tiktok_1080x1920.mp4"
    assert mp4.exists()
    # vérification indépendante du fichier produit (sans passer par le module qc)
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams",
                                       "-show_format", str(mp4)], capture_output=True, text=True).stdout)
    v = next(s for s in probe["streams"] if s["codec_type"] == "video")
    a = next(s for s in probe["streams"] if s["codec_type"] == "audio")
    assert (v["codec_name"], v["width"], v["height"], v["pix_fmt"]) == ("h264", 1080, 1920, "yuv420p")
    assert v["r_frame_rate"] == "30/1" and a["codec_name"] == "aac"
    dur = float(probe["format"]["duration"])
    tl = json.loads((proj / "timeline" / "v001.json").read_text())
    assert abs(dur - tl["expected_duration"]) < 0.35 and 10 < dur < 26.6
    err = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp4), "-f", "null", "-"], capture_output=True, text=True)
    assert err.stderr.strip() == "", "le fichier se décode entièrement sans erreur"
    lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", subprocess.run(
        ["ffmpeg", "-nostats", "-i", str(mp4), "-af", "ebur128", "-f", "null", "-"],
        capture_output=True, text=True).stderr)[-1])
    assert abs(lufs - -14) < 1.5
    # la parole se trouve bien aux endroits prévus par la timeline
    db = frame_db(ffmpeg.read_audio_mono(mp4, 16000))
    act = activity_regions(db, max(float(np.percentile(db, 20)) + 8, -45))
    t = 0.0
    for c in tl["clips"]:
        d = c["out"] - c["in"]
        if c["kind"] in ("parole", "teaser"):
            # les respirations gardées entre deux phrases sont silencieuses : on mesure la couverture
            cover = sum(max(0, min(t + d, y) - max(t, x)) for x, y in act) / d
            assert cover > 0.6, f"plan parlé {c['id']} : seulement {cover:.0%} de son à l'endroit prévu"
        t += d
    # première image : titre fourni ; sous-titres exportés ; livraison en attente de validation humaine
    assert (proj / "exports" / "e2e_v001_tiktok_1080x1920.srt").exists()
    liv = (proj / "exports" / "LIVRAISON.md").read_text(encoding="utf-8")
    assert "en attente de validation humaine" in liv and "Rien n'est publié automatiquement" in liv
    st = json.loads((proj / "project.json").read_text())
    assert st["approval"]["status"] == "en attente de validation humaine"
    run_cli(["approve", "e2e", "--by", "Testeur"], ws)
    assert json.loads((proj / "project.json").read_text())["approval"]["status"] == "validé par un humain"
    # les rushs originaux n'ont pas été modifiés
    assert all(p.exists() for p in media["demo_dir"].glob("*.mp4"))


def test_export_interrompu_puis_reprise(ws, media):
    """Le processus est tué pendant l'encodage ; aucun fichier final incomplet ; la relance termine le travail."""
    env = dict(os.environ, VSTUDIO_HOME=str(ws), VSTUDIO_EXTRA_PRESETS=str(EXTRA))
    args = [sys.executable, str(ROOT / "studio.py"), "run", "coupure", "--input", str(media["horizontal"]),
            str(media["horizontal2"]), "--preset", "youtube"]
    proc = subprocess.Popen(args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    proj = ws / "projects" / "coupure"
    deadline = time.time() + 300
    killed = False
    while time.time() < deadline and proc.poll() is None:
        parts = list(proj.glob("**/*.part.*")) if proj.exists() else []
        segs = list((proj / "cache").glob("seg_*.mkv")) if proj.exists() else []
        if parts and len(segs) >= 1:
            os.killpg(proc.pid, signal.SIGKILL)  # coupure brutale (comme une panne)
            killed = True
            break
        time.sleep(0.05)
    proc.wait()
    assert killed, "l'interruption n'a pas pu être provoquée pendant le rendu"
    assert not list((proj / "exports").glob("*.mp4")), "aucun export final incomplet ne doit exister"
    st = json.loads((proj / "project.json").read_text())
    assert any(v["status"] == "en cours" for v in st["steps"].values())
    out = run_cli(["project", "show", "coupure"], ws)
    assert "relancez" in out.stdout
    run_cli(["run", "coupure"], ws, timeout=900)
    journal = (proj / "journal.log").read_text(encoding="utf-8")
    assert "Analyse : déjà faite" in journal
    assert not list(proj.glob("**/*.part.*")), "fichiers temporaires nettoyés"
    mp4s = list((proj / "exports").glob("*.mp4"))
    assert len(mp4s) == 1 and not ffmpeg.decode_check(mp4s[0])


def test_revision_et_variantes(ws, media):
    run_cli(["run", "rev", "--input", str(media["vertical_voice"]), str(media["horizontal2"]), "--lang", "en",
             "--preset", "test_vertical", "--preview-only"], ws, timeout=600)
    out = run_cli(["revise", "rev", "Fais une version de 12 secondes, plus dynamique"], ws)
    assert "durée cible 12 s" in out.stdout and "v002" in out.stdout
    proj = ws / "projects" / "rev"
    tl2 = json.loads((proj / "timeline" / "v002.json").read_text())
    assert tl2["expected_duration"] <= 12.5
    assert (proj / "timeline" / "v001.json").exists(), "la version précédente est conservée"
    run_cli(["preview", "rev", "--version", "2"], ws, timeout=600)
    before = len((proj / "journal.log").read_text(encoding="utf-8"))
    out = run_cli(["revise", "rev", "Supprime le plan c02"], ws)
    tl3 = json.loads((proj / "timeline" / "v003.json").read_text())
    assert "c02" not in [c["id"] for c in tl3["clips"]] and len(tl3["clips"]) == len(tl2["clips"]) - 1
    out = run_cli(["preview", "rev", "--version", "3"], ws, timeout=600)
    after = (proj / "journal.log").read_text(encoding="utf-8")[before:]
    m = re.search(r"(\d+)/(\d+) segment\(s\) réutilisé", after)
    assert m and int(m.group(1)) == int(m.group(2)), "révision locale : tous les segments restants sont réutilisés"
    out = run_cli(["revise", "rev", "Fais trois propositions de montage différentes"], ws, timeout=600)
    assert out.stdout.count("v00") >= 3
    bad = run_cli(["revise", "rev", "Fais-moi un café"], ws, check=False)
    assert bad.returncode == 2 and "Demande non reconnue" in bad.stderr


def test_messages_erreur_comprehensibles(ws, media):
    r = run_cli(["run", "vide", "--input", str(ws / "nexiste_pas")], ws, check=False)
    assert r.returncode == 2 and "Introuvable" in r.stderr and "Traceback" not in r.stderr
    r = run_cli(["run", "x", "--input", str(media["horizontal"]), "--preset", "myspace"], ws, check=False)
    assert r.returncode == 2 and "Format d'export inconnu" in r.stderr and "tiktok" in r.stderr
    r = run_cli(["export", "projet-fantome"], ws, check=False)
    assert r.returncode == 2 and "Projet introuvable" in r.stderr


def test_reference_et_principes(ws, media):
    out = run_cli(["reference", str(media["horizontal"]), "--source", "généré pour les tests"], ws)
    rec = json.loads(next((ws / "references").glob("*.json")).read_text())
    assert rec["mesures"]["plans"] == 3 and rec["source_et_autorisation"] == "généré pour les tests"
    out = run_cli(["principles"], ws)
    assert "vérifié" in out.stdout and "pourquoi" in out.stdout
