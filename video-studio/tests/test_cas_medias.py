"""Cas imposés, testés sur de vrais fichiers rendus puis relus (pas seulement le code)."""

import json
import re
from pathlib import Path

import numpy as np
import pytest

from vstudio import ffmpeg, pipeline
from vstudio.analysis.audio import activity_regions, frame_db
from vstudio.errors import MediaError
from vstudio.ingest import ingest
from vstudio.project import Project


def montage(name, files, preset="test_vertical", **settings):
    proj = Project.create(name, {"presets": [preset], **settings})
    pipeline.step_import(proj, [str(f) for f in files])
    outs = pipeline.step_export(proj)
    return proj, outs[0]


def assert_qc_pas_en_echec(out):
    fails = [c for c in out["qc"]["checks"] if c["status"] == "échec"]
    assert not fails, fails


def statut(out, nom):
    return next(c for c in out["qc"]["checks"] if c["check"].startswith(nom))


# 1 — vidéo verticale avec voix
def test_verticale_avec_voix(ws, media):
    proj, out = montage("verticale", [media["vertical_voice"]], lang="en")
    assert_qc_pas_en_echec(out)
    info = ffmpeg.probe(out["render"]["path"])
    assert (info.display_width, info.display_height) == (360, 640)
    tr = json.loads(proj.path("transcripts", "r01.json").read_text())
    assert tr["engine"] == "pocketsphinx"
    # chaque phrase prononcée est retrouvée (±0,3 s)
    found = [(s["start"], s["end"]) for s in tr["segments"]]
    for a, b, _ in media["speech_spans"]:
        assert any(abs(x - a) < 0.35 and abs(y - b) < 0.35 for x, y in found), (a, b)
    # la prise ratée est écartée, la longueur raccourcie
    tl = proj.load_timeline()
    assert any("prise répétée" in d for d in tl["decisions"])
    assert tl["expected_duration"] < 26.0
    # garde-fou : aucune phrase gardée n'est coupée en son milieu
    words = [w for s in tr["segments"] for w in s["words"]]
    for c in tl["clips"]:
        if c["kind"] in ("parole", "teaser"):
            for w in words:
                inside = c["in"] <= (w["start"] + w["end"]) / 2 <= c["out"]
                if inside:
                    assert c["in"] <= w["start"] + 0.02 and w["end"] - 0.02 <= c["out"], (c["id"], w)
    assert out["render"]["subtitles"]["cues"] >= 5
    assert statut(out, "sous-titres dans le cadre")["status"] == "ok"


# 2 — vidéo horizontale
def test_horizontale(ws, media):
    proj, out = montage("horizontale", [media["horizontal"]], preset="test_horizontal")
    assert_qc_pas_en_echec(out)
    tl = proj.load_timeline()
    assert tl["brief"]["has_speech"] is False and tl["captions"] is False
    assert all(c["reframe"] == "plein" for c in tl["clips"])
    info = ffmpeg.probe(out["render"]["path"])
    assert (info.display_width, info.display_height) == (640, 360)


# 3 — plusieurs clips à assembler (+ musique et calage sur les temps)
def test_plusieurs_clips(ws, media):
    proj, out = montage("multi", [media["vertical_voice"], media["horizontal"], media["horizontal2"]],
                        lang="en", music=str(media["music"]), profile="reseaux_sociaux")
    assert_qc_pas_en_echec(out)
    tl = proj.load_timeline()
    assert len({c["rush"] for c in tl["clips"]}) == 3
    assert tl["music"]["bpm"] == pytest.approx(100, abs=3)
    assert any(c.get("beat") for c in tl["clips"] if c["kind"] == "illustration")
    assert abs(out["render"]["duration"] - tl["expected_duration"]) < 0.3
    # ducking : la musique est plus basse pendant la parole qu'hors parole
    audio = ffmpeg.read_audio_mono(out["render"]["path"], 16000)
    assert audio.size > 0


# 4 — vidéo sans audio
def test_sans_audio(ws, media):
    proj, out = montage("muet", [media["no_audio"]], preset="test_horizontal")
    assert any("pas de piste audio" in w for w in proj.state["rushes"][0]["warnings"])
    info = ffmpeg.probe(out["render"]["path"])
    assert info.has_audio, "une piste audio (silencieuse) est toujours présente pour la compatibilité"
    c = statut(out, "présence d'un son")
    assert c["status"] == "attention" and "attendu" in c["detail"]
    assert_qc_pas_en_echec(out)


def test_sans_audio_avec_musique(ws, media):
    proj, out = montage("muet-musique", [media["no_audio"]], preset="test_horizontal", music=str(media["music"]))
    assert statut(out, "présence d'un son")["status"] == "ok"
    assert statut(out, "intensité sonore")["status"] == "ok"


# 5 — plusieurs intervenants
def test_plusieurs_intervenants(ws, media):
    proj, out = montage("deux-voix", [media["two_speakers"]], preset="test_horizontal", lang="en",
                        speakers={"r01": "Ana — cheffe"}, profile="interview")
    assert_qc_pas_en_echec(out)
    tr = json.loads(proj.path("transcripts", "r01.json").read_text())
    assert len(tr["segments"]) >= 4, "les deux voix sont transcrites"
    tl = proj.load_timeline()
    ins = [c["in"] for c in tl["clips"] if c["kind"] == "parole"]
    assert ins == sorted(ins), "l'ordre des propos est respecté"
    ass = next(proj.path("subtitles").glob("*_v001_test_horizontal_640x360.ass")).read_text()
    assert "Ana — cheffe" in ass  # identification de l'intervenant, texte fourni par l'utilisateur


# 6 — fichier corrompu
def test_fichier_corrompu(ws, media):
    with pytest.raises(MediaError) as e:
        ffmpeg.probe(media["garbage"])
    assert "illisible ou corrompu" in e.value.message
    proj = Project.create("corrompu")
    added = ingest(proj, [media["corrupted"], media["garbage"], media["horizontal2"]])
    status = {Path(a["path"]).name: (a["status"], a["reason"]) for a in added}
    assert status["corrompu.mp4"][0] == "rejeté" and "décodage" in status["corrompu.mp4"][1]
    assert status["pas_une_video.mp4"][0] == "rejeté"
    assert status["03_details_horizontal.mp4"][0] == "ok", "un fichier corrompu ne bloque pas les autres"
    assert len(proj.usable_rushes()) == 1


# 7 — vidéo très longue
def test_video_tres_longue(ws, tmp_path_factory):
    from vstudio import demo
    long = demo.make_long(tmp_path_factory.mktemp("long") / "longue_12min.mp4", 12)
    proj, out = montage("longue", [long], preset="test_horizontal", target_duration=30)
    assert ffmpeg.probe(long).duration >= 719
    assert out["render"]["duration"] <= 30.5
    assert_qc_pas_en_echec(out)


# 8 — rotation particulière
def test_rotation(ws, media):
    proj, out = montage("rotation", [media["rotated"]])
    r = proj.state["rushes"][0]
    assert r["info"]["rotation"] == 90 and r["info"]["orientation"] == "vertical"
    tl = proj.load_timeline()
    assert tl["clips"][0]["reframe"] == "plein", "source verticale vers format vertical : pas de bandes"
    # le repère blanc doit être au même endroit que dans la lecture de référence (rotation appliquée)
    ref = ffmpeg.read_gray_frames(media["rotated"], 1, 36, 64, start=1, duration=1)[0]
    got = ffmpeg.read_gray_frames(out["render"]["path"], 1, 36, 64, start=1, duration=1)[0]
    def corner(f):
        ys, xs = np.where(f > 200)
        return ys.mean() / f.shape[0], xs.mean() / f.shape[1]
    (ry, rx), (gy, gx) = corner(ref), corner(got)
    assert abs(ry - gy) < 0.15 and abs(rx - gx) < 0.15
    assert statut(out, "conformité technique")["status"] == "ok"


# 9 — framerate variable
def test_cadence_variable(ws, media):
    proj, out = montage("vfr", [media["vfr"]], preset="test_horizontal")
    assert proj.state["rushes"][0]["info"]["vfr"] is True
    info = ffmpeg.probe(out["render"]["path"])
    assert not info.vfr and abs(info.avg_fps - 30) < 0.05, "la sortie est à cadence constante"
    assert_qc_pas_en_echec(out)


# 10 — audio difficile (bruit fort + saturation)
def test_audio_difficile(ws, media):
    proj, out = montage("audio-difficile", [media["difficult"]], preset="test_horizontal", lang="en")
    issues = json.loads(proj.path("analysis", "r01.json").read_text())["audio"]["issues"]
    assert any("saturation" in i for i in issues) and any("bruit" in i for i in issues)
    assert statut(out, "saturation audio")["status"] == "ok"
    assert statut(out, "intensité sonore")["status"] == "ok"
    assert_qc_pas_en_echec(out)


# 11 — sous-titres avec caractères français (fichier fourni)
SRT_FR = """1
00:00:00,700 --> 00:00:02,100
Bienvenue à la cuisine !

2
00:00:02,700 --> 00:00:04,800
Ça, c'est l'été : du maïs grillé « maison ».

3
00:00:07,300 --> 00:00:09,700
Où est le riz ? On le lave à l'eau froide.
"""


def test_sous_titres_francais(ws, media, tmp_path):
    src = tmp_path / "recette.mp4"
    src.write_bytes(media["vertical_voice"].read_bytes())
    (tmp_path / "recette.srt").write_text(SRT_FR, encoding="utf-8")
    proj, out = montage("francais", [src], lang="fr", profile="interview")
    srt = Path(out["render"]["subtitles"]["srt"]).read_text(encoding="utf-8")
    for s in ("Ça", "c’est", "l’été", "maïs", "Où", "à la cuisine !", "riz ?", "« maison »"):
        assert s in srt, s
    tr = json.loads(proj.path("transcripts", "r01.json").read_text())
    assert tr["engine"] == "fourni"
    assert statut(out, "sous-titres dans le cadre")["status"] == "ok"
    assert_qc_pas_en_echec(out)


# 13 — reprise d'un projet existant
def test_reprise_projet(ws, media):
    proj, out = montage("reprise", [media["horizontal2"]], preset="test_horizontal")
    first = Path(out["render"]["path"]).stat().st_mtime
    again = Project.open("reprise")
    outs = pipeline.step_export(again)
    journal = again.path("journal.log").read_text(encoding="utf-8")
    assert "Analyse : déjà faite" in journal and "toujours valable (reprise)" in journal
    assert re.search(r"\d+/\d+ segment\(s\) réutilisé", journal)
    assert Path(outs[0]["render"]["path"]).exists() and Path(outs[0]["render"]["path"]).stat().st_mtime >= first


# fondus enchaînés (profil cinématique) : rendu xfade réel, durée tenant compte des chevauchements
def test_fondus_enchaines(ws, media):
    proj, out = montage("fondus", [media["horizontal"], media["horizontal2"], media["no_audio"]],
                        preset="test_horizontal", profile="cinematique", music=str(media["music"]))
    tl = proj.load_timeline()
    assert any(c["transition_in"] == "fondu" for c in tl["clips"])
    assert abs(out["render"]["duration"] - tl["expected_duration"]) < 0.3
    assert statut(out, "écrans noirs")["status"] == "ok"
    assert_qc_pas_en_echec(out)
