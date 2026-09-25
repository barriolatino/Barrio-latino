"""Voix off : script → voiceover.wav, fournisseur choisi par TTS_PROVIDER.

| TTS_PROVIDER | Voix | Coût | Testé en réel |
|---|---|---|---|
| none | voix enregistrée par Tio Clem (assets/audio/voice/day-NN.*) | gratuit | oui |
| mock | bips aux durées des phrases, **tests uniquement** | gratuit | oui |
| piper | TTS local open source (modèle .onnx français) | gratuit | non (modèle non téléchargeable ici) |
| openai | API OpenAI /v1/audio/speech | payant | non (API injoignable ici) |
| elevenlabs | API ElevenLabs /v1/text-to-speech | payant | non (API injoignable ici) |

Chaque voix générée est mise en cache avec l'empreinte du texte : si le script ne
change pas, elle n'est pas régénérée (ni refacturée).
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import env
import net as _http  # tools/net.py
from render import ffmpeg_exe

ROOT = Path(__file__).resolve().parents[2]
TTS_DIR = ROOT / "assets" / "audio" / "tts"
HUMAN_DIR = ROOT / "assets" / "audio" / "voice"
STYLE = json.loads((ROOT / "config" / "video-style.json").read_text(encoding="utf-8"))
INSTRUCTIONS = ("Voix française masculine, naturelle et chaleureuse, enthousiaste mais pas trop rapide. "
                "Ton d'un ami qui raconte quelque chose d'intéressant, pas d'un présentateur.")


class Provider:
    name = "base"
    is_mock = False
    tested_live = False

    def synthesize(self, text: str, out: Path) -> dict:  # pragma: no cover - interface
        raise NotImplementedError


def _to_wav(src: Path, out: Path) -> None:
    """Convertit n'importe quel audio en WAV mono 44,1 kHz 16 bits."""
    r = subprocess.run([ffmpeg_exe(), "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
                        "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", str(out)], capture_output=True, text=True)
    if r.returncode != 0:
        raise _http.ProviderError(f"conversion WAV impossible : {r.stderr[:200]}")


class MockProvider(Provider):
    """Bips de 440 Hz, un par phrase, de la durée qu'aurait la phrase dite. Jamais publiable."""
    name, is_mock, tested_live = "mock", True, True

    def synthesize(self, text: str, out: Path) -> dict:
        rate = STYLE["voice"]["words_per_second_estimate"]
        parts = [s for s in re.split(r"(?<=[.?!…])\s+", text.strip()) if s.strip()]
        inputs, n = [], 0
        for p in parts:
            d = max(0.4, len(p.split()) / rate)
            inputs += ["-f", "lavfi", "-t", f"{d:.2f}", "-i", "sine=frequency=440:sample_rate=44100",
                       "-f", "lavfi", "-t", "0.35", "-i", "anullsrc=r=44100:cl=mono"]
            n += 2
        concat = "".join(f"[{i}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1,volume=0.2[a]"
        r = subprocess.run([ffmpeg_exe(), "-y", "-hide_banner", "-loglevel", "error", *inputs,
                            "-filter_complex", concat, "-map", "[a]", "-ac", "1", "-c:a", "pcm_s16le", str(out)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            raise _http.ProviderError(f"mock : {r.stderr[:200]}")
        return {"provider": self.name, "mock": True}


class OpenAIProvider(Provider):
    name = "openai"
    URL = "https://api.openai.com/v1/audio/speech"

    def synthesize(self, text: str, out: Path) -> dict:
        key = env.require("OPENAI_API_KEY", "TTS openai")
        voice = env.get("TTS_VOICE", "coral")
        model = env.get("TTS_MODEL", "gpt-4o-mini-tts")
        data = _http.post_json(self.URL, {"Authorization": f"Bearer {key}"},
                               {"model": model, "input": text, "voice": voice, "instructions": INSTRUCTIONS,
                                "response_format": "wav"})
        out.write_bytes(data)
        return {"provider": self.name, "model": model, "voice": voice}


class ElevenLabsProvider(Provider):
    name = "elevenlabs"
    URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128"

    def synthesize(self, text: str, out: Path) -> dict:
        key = env.require("ELEVENLABS_API_KEY", "TTS elevenlabs")
        voice = env.require("ELEVENLABS_VOICE_ID", "TTS elevenlabs")
        model = env.get("TTS_MODEL", "eleven_multilingual_v2")
        data = _http.post_json(self.URL.format(voice=voice), {"xi-api-key": key, "Accept": "audio/mpeg"},
                               {"text": text, "model_id": model,
                                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "speed": 1.0}})
        with tempfile.TemporaryDirectory() as tmp:
            mp3 = Path(tmp) / "v.mp3"
            mp3.write_bytes(data)
            _to_wav(mp3, out)
        return {"provider": self.name, "model": model, "voice": voice}


class PiperProvider(Provider):
    """TTS local : `pip install piper-tts` + un modèle français (.onnx et .onnx.json)."""
    name = "piper"

    def synthesize(self, text: str, out: Path) -> dict:
        model = env.require("PIPER_MODEL_PATH", "TTS piper")
        if not Path(model).exists():
            raise env.MissingConfig(f"TTS piper : modèle introuvable ({model})")
        exe = shutil.which("piper")
        if not exe:
            raise env.MissingConfig("TTS piper : commande « piper » absente (pip install piper-tts)")
        r = subprocess.run([exe, "--model", model, "--output_file", str(out)], input=text,
                           capture_output=True, text=True)
        if r.returncode != 0 or not out.exists():
            raise _http.ProviderError(f"piper : {r.stderr[:200]}")
        return {"provider": self.name, "model": Path(model).name}


PROVIDERS = {p.name: p for p in (MockProvider, OpenAIProvider, ElevenLabsProvider, PiperProvider)}


def provider_name() -> str:
    return "mock" if env.mock_enabled() else env.get("TTS_PROVIDER", "none")


def get_provider(name: str | None = None) -> Provider | None:
    """None = pas de voix de synthèse (voix humaine ou piste silencieuse)."""
    name = name or provider_name()
    if name in ("", "none"):
        return None
    if name not in PROVIDERS:
        raise env.MissingConfig(f"TTS_PROVIDER inconnu : {name} (choix : none, {', '.join(PROVIDERS)})")
    return PROVIDERS[name]()


def script_for_tts(post: dict) -> str:
    """Texte à dire : les voix off des scènes, une scène par paragraphe."""
    return "\n\n".join(sc["voiceover"].strip() for sc in post.get("scenes", []))


def human_voice(day: int) -> Path | None:
    for ext in ("m4a", "mp3", "wav", "aac"):
        p = HUMAN_DIR / f"day-{day:02d}.{ext}"
        if p.exists():
            return p
    return None


def resolve(post: dict, provider: Provider | None = None) -> tuple[Path | None, dict]:
    """Voix à utiliser pour un post : humaine d'abord, sinon synthèse (avec cache), sinon aucune."""
    human = human_voice(post["day"])
    if human:
        return human, {"source": "human", "file": str(human.relative_to(ROOT)), "mock": False}
    provider = provider if provider is not None else get_provider()
    if provider is None:
        return None, {"source": "none", "mock": False}
    text = script_for_tts(post)
    digest = hashlib.sha256(f"{provider.name}|{env.get('TTS_VOICE')}|{text}".encode()).hexdigest()[:16]
    TTS_DIR.mkdir(parents=True, exist_ok=True)
    wav = TTS_DIR / f"day-{post['day']:02d}.{provider.name}.wav"
    meta_file = wav.with_suffix(".json")
    if wav.exists() and meta_file.exists() and json.loads(meta_file.read_text())["hash"] == digest:
        meta = json.loads(meta_file.read_text())
        return wav, {**meta, "cached": True}
    info = provider.synthesize(text, wav)
    meta = {"source": "tts", **info, "mock": provider.is_mock, "tested_live": provider.tested_live,
            "hash": digest, "file": str(wav.relative_to(ROOT)), "text_chars": len(text)}
    meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return wav, meta


def export_wav(src: Path, out: Path) -> None:
    """voiceover.wav du dossier de sortie (mono 44,1 kHz), quelle que soit la source."""
    _to_wav(src, out)
