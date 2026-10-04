"""Fixtures : médias de test synthétiques (générés une fois par session) et espace de travail isolé."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from vstudio import demo  # noqa: E402

EXTRA = ROOT / "tests" / "presets_test.toml"


@pytest.fixture(scope="session")
def media(tmp_path_factory) -> dict:
    d = tmp_path_factory.mktemp("medias")
    m = {}
    m["demo_dir"] = d / "demo"
    info = demo.make_demo_set(m["demo_dir"])
    m["music"] = Path(info["music"])
    m["speech_spans"] = info["speech_spans"]
    m["vertical_voice"] = m["demo_dir"] / "01_face_camera_vertical.mp4"
    m["horizontal"] = m["demo_dir"] / "02_gestes_horizontal.mp4"
    m["horizontal2"] = m["demo_dir"] / "03_details_horizontal.mp4"
    m["no_audio"] = demo.make_clip(d / "sans_audio.mp4", 640, 360, [("life", 3.0), ("mandelbrot", 3.0)],
                                   ambience_db=None)
    voice2 = d / "deux_voix.wav"
    m["two_spans"] = demo.speech_track(voice2, [("pause", 0.5), ("Hello and welcome to the show.", "kal"),
                                                ("pause", 0.7), ("Thank you, I am happy to be here.", "slt"),
                                                ("pause", 0.7), ("Tell us about your restaurant.", "kal"),
                                                ("pause", 0.7), ("We cook food from Latin America.", "slt"),
                                                ("pause", 0.6)])
    dur = demo.ffmpeg.probe(voice2).duration
    m["two_speakers"] = demo.make_clip(d / "deux_intervenants.mp4", 640, 360, [("gradient", round(dur, 2))],
                                       audio=voice2)
    m["rotated"] = demo.make_rotated(d / "rotation90.mp4", 90)
    m["vfr"] = demo.make_vfr(d / "cadence_variable.mp4")
    m["difficult"] = demo.make_difficult_audio(d / "audio_difficile.mp4")
    m["corrupted"] = demo.make_corrupted(d / "corrompu.mp4", m["horizontal"])
    m["garbage"] = d / "pas_une_video.mp4"
    m["garbage"].write_bytes(os.urandom(50_000))
    return m


@pytest.fixture()
def ws(tmp_path, monkeypatch) -> Path:
    """Espace de travail isolé (projects/, input/, exports/) pour chaque test."""
    monkeypatch.setenv("VSTUDIO_HOME", str(tmp_path))
    monkeypatch.setenv("VSTUDIO_QUIET", "1")
    monkeypatch.setenv("VSTUDIO_EXTRA_PRESETS", str(EXTRA))
    return tmp_path


def run_cli(args: list[str], ws: Path, timeout: int = 600, check: bool = True) -> subprocess.CompletedProcess:
    env = dict(os.environ, VSTUDIO_HOME=str(ws), VSTUDIO_EXTRA_PRESETS=str(EXTRA))
    proc = subprocess.run([sys.executable, str(ROOT / "studio.py"), *args], capture_output=True, text=True,
                          env=env, timeout=timeout)
    if check and proc.returncode != 0:
        raise AssertionError(f"commande en échec ({proc.returncode}) : {args}\n{proc.stdout[-3000:]}\n{proc.stderr[-3000:]}")
    return proc
