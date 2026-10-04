"""Tests unitaires : typographie, découpage des sous-titres, profils, révisions, garde-fous éditoriaux."""

import pytest

from vstudio import config, planner, revise
from vstudio import subtitles as S
from vstudio.analysis.runner import find_retakes
from vstudio.errors import ConfigError


def test_typographie_francaise():
    t = S.french_typography("Ça, c'est l'été ! Où est « la cuisine » ? Note : maïs grillé ; voilà")
    assert "été !" in t and "cuisine »" in t and "« la" in t
    assert "Note :" in t and "grillé ;" in t and "c’est" in t
    assert "Où" in t and "maïs" in t  # accents et trémas intacts


def test_sous_titres_lisibles_sans_mot_orphelin():
    words = [{"w": w, "start": i * 0.3, "end": i * 0.3 + 0.25} for i, w in
             enumerate("Then we cut the fresh vegetables into small pieces and we add some water".split())]
    cues = S.build_cues(words, 26, 2)
    for c in cues:
        lines = S.balanced_two_lines(c["text"], 26)
        assert len(lines) <= 2 and all(len(x) <= 26 for x in lines)
        assert len(c["text"].split()) >= 2, "un mot seul sur un sous-titre"
        assert c["end"] - c["start"] >= 0.99
    assert " ".join(c["text"] for c in cues).split() == [w["w"] for w in words], "aucun mot ajouté ni perdu"


def test_sous_titres_ne_se_chevauchent_pas():
    words = [{"w": f"mot{i}", "start": i * 0.2, "end": i * 0.2 + 0.15} for i in range(40)]
    cues = S.build_cues(words, 20, 2)
    for a, b in zip(cues, cues[1:]):
        assert a["end"] <= b["start"]


def test_srt_vtt(tmp_path):
    cues = [{"start": 0.5, "end": 2.0, "text": "Ça va ?", "lines": ["Ça va ?"], "uncertain": []}]
    S.write_srt(cues, tmp_path / "a.srt")
    S.write_vtt(cues, tmp_path / "a.vtt")
    assert "00:00:00,500 --> 00:00:02,000" in (tmp_path / "a.srt").read_text(encoding="utf-8")
    assert (tmp_path / "a.vtt").read_text(encoding="utf-8").startswith("WEBVTT")


def test_profils_heritage_et_surcharges():
    p = config.editorial_profile("podcast")
    assert p["pause_max"] == 1.0 and p["duck_db"] == -18.0  # hérité d'interview
    with pytest.raises(ConfigError):
        config.editorial_profile("inexistant")
    with pytest.raises(ConfigError):
        config.editorial_profile("vlog", {"parametre_invente": 1})
    for name in config.editorial_profiles():
        if name != "defaut":
            prof = config.editorial_profile(name)
            config.color_profile(prof["color"])
            config.export_preset(prof["default_preset"])


@pytest.mark.parametrize("phrase", revise.EXAMPLES)
def test_revisions_reconnues(phrase):
    prof = config.editorial_profile("reseaux_sociaux")
    req = revise.parse(phrase, prof, has_speech=True)
    assert req["changes"], phrase


def test_revision_inconnue_message_clair():
    with pytest.raises(ConfigError) as e:
        revise.parse("Fais-moi un café", config.editorial_profile("vlog"), True)
    assert "non reconnue" in e.value.message and "Exemples" in e.value.hint


def test_revision_ralenti_sans_cible_demande_precision():
    with pytest.raises(ConfigError) as e:
        revise.parse("Ralentis cette séquence", config.editorial_profile("vlog"), True)
    assert "plan" in e.value.hint


def test_revision_valeurs():
    prof = config.editorial_profile("reseaux_sociaux")
    r = revise.parse("Fais une version de 30 secondes, plus dynamique", prof, True)
    assert r["settings"]["target_duration"] == 30
    assert r["overrides"]["max_shot"] == pytest.approx(prof["max_shot"] * 0.75)
    r = revise.parse("Crée une version TikTok et une version YouTube", prof, True)
    assert r["settings"]["presets"] == ["tiktok", "youtube"]
    r = revise.parse("Fais trois propositions de montage différentes", prof, True)
    assert r["variants"] == 3


def test_prises_repetees_garde_la_derniere():
    segs = [{"start": 0, "end": 2, "text": "Then we cut the fresh vegetables"},
            {"start": 3, "end": 6, "text": "Then we cut the fresh vegetables into small pieces"},
            {"start": 7, "end": 9, "text": "Everything goes into the pan"}]
    r = find_retakes(segs)
    assert r == [{"drop": 0, "keep": 1, "similarity": r[0]["similarity"], "text": segs[0]["text"]}]


def test_calage_musical_ne_touche_pas_la_parole():
    clips = [{"rush": "r1", "in": 0, "out": 3.1, "kind": "parole"},
             {"rush": "r2", "in": 0, "out": 2.3, "kind": "illustration"},
             {"rush": "r2", "in": 5, "out": 7.2, "kind": "illustration"}]
    before = clips[0]["out"]
    beats = [i * 0.6 for i in range(30)]
    n = planner.beat_sync(clips, beats, 0.3, 1.0, {"r1": 10, "r2": 20}, 0.4)
    assert clips[0]["out"] == before
    assert n >= 1
    t = 0
    for c in clips:
        t += c["out"] - c["in"]
        if c.get("beat"):
            assert min(abs(t - b) for b in beats) < 1e-6


def test_recadrage_signale_pour_validation():
    rush = {"id": "r1", "info": {"display_width": 1920, "display_height": 1080}}
    prof = config.editorial_profile("reseaux_sociaux")
    mode, x, flags = planner.reframe_mode(rush, 1080, 1920, prof, 0.3, 0.8)
    assert mode == "recadrage" and flags and "vérifier" in flags[0]
    mode, x, flags = planner.reframe_mode(rush, 1080, 1920, prof, 0.5, 0.2)
    assert mode == "flou" and not flags  # sujet incertain → pas de recadrage aveugle
    mode, _, _ = planner.reframe_mode(rush, 1920, 1080, prof, 0.5, 0.2)
    assert mode == "plein"
