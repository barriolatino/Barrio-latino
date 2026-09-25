"""Tests de la Phase 3 : voix (TTS), visuels (Mode A / Mode B), sous-titres, mode MOCK.

Les fournisseurs payants (OpenAI, ElevenLabs) ne sont pas joignables depuis l'environnement
de développement : leurs tests vérifient la requête construite grâce à un transport de test.
Ils ne prouvent PAS que l'API réelle répond ; c'est signalé par `tested_live = False`.
Tout travaille dans des dossiers temporaires : aucun fichier du projet n'est modifié.
"""
import base64
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import env  # noqa: E402
import net  # noqa: E402
import render  # noqa: E402
from images import prompts, sourced  # noqa: E402
from images import providers as images  # noqa: E402
from subtitles import srt  # noqa: E402
from voice import providers as voice  # noqa: E402

POST1 = json.loads((ROOT / "content/posts/day-01.json").read_text(encoding="utf-8"))


class FakeTransport:
    """Enregistre la requête et renvoie une réponse préparée (jamais le vrai service)."""

    def __init__(self, status=200, body=b""):
        self.status, self.body, self.calls = status, body, []

    def __call__(self, method, url, headers, body, timeout):
        self.calls.append({"method": method, "url": url, "headers": headers, "json": json.loads(body)})
        return self.status, self.body


class TempDirs(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.saved = (voice.TTS_DIR, voice.HUMAN_DIR, images.OWN, images.GENERATED, sourced.SOURCED,
                      sourced.MANIFEST, sourced.ROOT, net.transport, dict(os.environ), env._cache)
        voice.TTS_DIR, voice.HUMAN_DIR = self.tmp / "tts", self.tmp / "voice"
        images.OWN, images.GENERATED = self.tmp / "own", self.tmp / "gen"
        sourced.SOURCED, sourced.MANIFEST, sourced.ROOT = self.tmp / "src", self.tmp / "src" / "m.json", self.tmp
        voice.ROOT = images.ROOT = self.tmp
        env._cache = {}
        for k in ("MOCK", "TTS_PROVIDER", "IMAGE_PROVIDER", "OPENAI_API_KEY", "ELEVENLABS_API_KEY",
                  "ELEVENLABS_VOICE_ID", "TTS_VOICE", "PIPER_MODEL_PATH"):
            os.environ.pop(k, None)

    def tearDown(self):
        (voice.TTS_DIR, voice.HUMAN_DIR, images.OWN, images.GENERATED, sourced.SOURCED, sourced.MANIFEST,
         sourced.ROOT, net.transport, environ, env._cache) = self.saved
        voice.ROOT = images.ROOT = ROOT
        os.environ.clear()
        os.environ.update(environ)


class Env(TempDirs):
    def test_env_file_and_precedence(self):
        env._cache = None
        saved_root = env.ROOT
        env.ROOT = self.tmp
        (self.tmp / ".env").write_text("# commentaire\nTTS_PROVIDER=openai\nTTS_VOICE='marin'\n")
        try:
            self.assertEqual(env.get("TTS_PROVIDER"), "openai")
            self.assertEqual(env.get("TTS_VOICE"), "marin")
            os.environ["TTS_PROVIDER"] = "piper"
            self.assertEqual(env.get("TTS_PROVIDER"), "piper")
            with self.assertRaises(env.MissingConfig):
                env.require("OPENAI_API_KEY", "test")
        finally:
            env.ROOT, env._cache = saved_root, {}

    def test_mock_flag_overrides_providers(self):
        os.environ["MOCK"] = "1"
        os.environ["TTS_PROVIDER"] = "openai"
        self.assertTrue(voice.get_provider().is_mock)
        self.assertTrue(images.get_provider().is_mock)


class Voice(TempDirs):
    def test_none_means_no_tts(self):
        self.assertIsNone(voice.get_provider("none"))
        wav, meta = voice.resolve(dict(POST1, day=77))
        self.assertIsNone(wav)
        self.assertEqual(meta["source"], "none")

    def test_human_voice_has_priority(self):
        voice.HUMAN_DIR.mkdir(parents=True)
        (voice.HUMAN_DIR / "day-77.m4a").write_bytes(b"x")
        wav, meta = voice.resolve(dict(POST1, day=77), voice.get_provider("mock"))
        self.assertEqual(meta["source"], "human")

    def test_mock_voice_is_real_audio_flagged_and_cached(self):
        post = dict(POST1, day=77)
        wav, meta = voice.resolve(post, voice.get_provider("mock"))
        self.assertTrue(meta["mock"])
        dur = render.probe_duration(wav)
        self.assertTrue(20 < dur < 50, dur)
        self.assertGreaterEqual(len(render.detect_silences(wav, -35, 0.12)), len(post["scenes"]) - 1)
        _, again = voice.resolve(post, voice.get_provider("mock"))
        self.assertTrue(again.get("cached"))
        changed = json.loads(json.dumps(post))
        changed["scenes"][0]["voiceover"] = "Texte modifié."
        _, regen = voice.resolve(changed, voice.get_provider("mock"))
        self.assertFalse(regen.get("cached"))

    def test_openai_request(self):
        os.environ["OPENAI_API_KEY"] = "test-key"
        net.transport = t = FakeTransport(200, b"RIFF....WAVE")
        out = self.tmp / "o.wav"
        info = voice.get_provider("openai").synthesize("Bonjour Pérou.", out)
        call = t.calls[0]
        self.assertEqual(call["url"], "https://api.openai.com/v1/audio/speech")
        self.assertEqual(call["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(call["json"]["response_format"], "wav")
        self.assertEqual(call["json"]["input"], "Bonjour Pérou.")
        self.assertIn(call["json"]["model"], ("gpt-4o-mini-tts", "tts-1", "tts-1-hd"))
        self.assertEqual(out.read_bytes(), b"RIFF....WAVE")
        self.assertFalse(voice.OpenAIProvider.tested_live)
        self.assertEqual(info["provider"], "openai")

    def test_elevenlabs_request_and_wav_conversion(self):
        os.environ["ELEVENLABS_API_KEY"], os.environ["ELEVENLABS_VOICE_ID"] = "k", "voix123"
        mp3 = subprocess.run([render.ffmpeg_exe(), "-loglevel", "error", "-f", "lavfi", "-t", "0.5", "-i",
                              "sine=frequency=300", "-f", "mp3", "-"], capture_output=True).stdout
        net.transport = t = FakeTransport(200, mp3)
        out = self.tmp / "e.wav"
        voice.get_provider("elevenlabs").synthesize("Hola.", out)
        call = t.calls[0]
        self.assertTrue(call["url"].startswith("https://api.elevenlabs.io/v1/text-to-speech/voix123"))
        self.assertEqual(call["headers"]["xi-api-key"], "k")
        self.assertEqual(call["json"]["model_id"], "eleven_multilingual_v2")
        self.assertAlmostEqual(render.probe_duration(out), 0.5, delta=0.1)

    def test_provider_errors_are_explicit(self):
        os.environ["OPENAI_API_KEY"] = "k"
        net.transport = FakeTransport(401, b'{"error":"bad key"}')
        with self.assertRaises(net.ProviderError):
            voice.get_provider("openai").synthesize("x", self.tmp / "x.wav")
        for name in ("elevenlabs", "piper"):
            with self.assertRaises(env.MissingConfig):
                voice.get_provider(name).synthesize("x", self.tmp / "x.wav")
        with self.assertRaises(env.MissingConfig):
            voice.get_provider("inconnu")


class Images(TempDirs):
    def unit(self, **visual):
        return {"id": "scene03", "visual": {"need": "assiette de ceviche", "description": "vue de dessus", **visual}}

    def test_prompt_rules(self):
        p = prompts.build({"need": "marché de Cusco", "description": "étals de fruits"}, {})
        for rule in ("no text", "no flags", "culturally accurate"):
            self.assertIn(rule, p["prompt"])
        self.assertEqual(p["size"], "1024x1536")

    def test_default_is_brand_card(self):
        path, meta = images.resolve(dict(POST1, day=77), self.unit())
        self.assertIsNone(path)
        self.assertEqual(meta["type"], "card")

    def test_priority_own_then_sourced_then_generated(self):
        post = dict(POST1, day=77)
        u = self.unit(asset_type="generated")
        _, meta = images.resolve(post, u, images.get_provider("mock"))
        self.assertEqual((meta["type"], meta["mock"]), ("generated", True))
        self.assertIn("no text", meta["prompt"])
        (self.tmp / "src").mkdir()
        from PIL import Image
        Image.new("RGB", (10, 10)).save(self.tmp / "src" / "a.jpg")
        sourced.register("src/a.jpg", "CC0", 77, "scene03", "Commons", "https://x", "Ana", "https://l")
        _, meta = images.resolve(post, u, images.get_provider("mock"))
        self.assertEqual(meta["type"], "sourced")
        (images.OWN / "day-77").mkdir(parents=True)
        Image.new("RGB", (10, 10)).save(images.OWN / "day-77" / "scene03.jpg")
        _, meta = images.resolve(post, u, images.get_provider("mock"))
        self.assertEqual(meta["type"], "own")

    def test_licenses(self):
        from PIL import Image
        (self.tmp / "src").mkdir()
        Image.new("RGB", (10, 10)).save(self.tmp / "src" / "b.jpg")
        for bad in ("CC BY-NC 4.0", "CC BY-ND 4.0", "tous droits réservés"):
            with self.assertRaises(ValueError):
                sourced.register("src/b.jpg", bad, 1, "slide01", "s", "https://x", "a", "https://l")
        with self.assertRaises(ValueError):  # auteur manquant
            sourced.register("src/b.jpg", "CC BY 4.0", 1, "slide01", "s", "https://x", "", "https://l")
        e = sourced.register("src/b.jpg", "CC BY-SA 4.0", 1, "slide01", "Commons", "https://x", "Ana", "https://l")
        self.assertTrue(e["attribution_required"])
        self.assertIn("Ana", sourced.credit(e))
        self.assertFalse(sourced.register("src/b.jpg", "own", 1, "slide02")["attribution_required"])

    def test_openai_images_request(self):
        os.environ["OPENAI_API_KEY"] = "k"
        net.transport = t = FakeTransport(200, json.dumps({"data": [{"b64_json": base64.b64encode(b"JPEGDATA").decode()}]}).encode())
        out = self.tmp / "g.jpg"
        images.get_provider("openai").generate("a market in Cusco", out)
        call = t.calls[0]
        self.assertEqual(call["url"], "https://api.openai.com/v1/images/generations")
        self.assertEqual((call["json"]["size"], call["json"]["n"]), ("1024x1536", 1))
        self.assertEqual(out.read_bytes(), b"JPEGDATA")
        net.transport = FakeTransport(200, b'{"data": []}')
        with self.assertRaises(net.ProviderError):
            images.get_provider("openai").generate("x", out)


class Subtitles(unittest.TestCase):
    def test_readability_rules(self):
        ok = srt.readability([(0.0, 1.5, "Le ceviche,"), (1.5, 3.0, "c'est pas juste du")], 3.0)
        self.assertEqual(ok, {"errors": [], "warnings": []})
        bad = srt.readability([(0.0, 1.0, "une ligne bien trop longue pour un écran de téléphone"),
                               (0.8, 1.0, "court"), (1.0, 1.3, "vingt-cinq caractères ici")], 1.0)
        self.assertTrue(any("trop long" in e for e in bad["errors"]))
        self.assertTrue(any("chevauche" in e for e in bad["errors"]))
        self.assertTrue(any("au-delà de la fin" in e for e in bad["errors"]))
        self.assertTrue(any("caractères/s" in w for w in bad["warnings"]))

    def test_sync_on_real_human_voice(self):
        voice_file = ROOT / "assets/audio/voice/day-01.m4a"
        post = json.loads(json.dumps(POST1))
        length = render.probe_duration(voice_file)
        cues = srt.sync_to_voice(post["scenes"], length, render.detect_silences(voice_file, -35, 0.12))
        self.assertEqual(srt.readability(cues, length)["errors"], [])
        self.assertAlmostEqual(sum(s["duration"] for s in post["scenes"]), length, delta=0.1)
        self.assertEqual([c[0] for c in cues], sorted(c[0] for c in cues))

    def test_srt_roundtrip(self):
        cues = [(0.05, 1.2, "Le ceviche,"), (1.2, 2.5, "c'est pas juste\ndu poisson cru")]
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "s.srt"
            srt.write_srt(cues, f)
            self.assertEqual(srt.parse_srt(f), [(0.05, 1.2, "Le ceviche,"), (1.2, 2.5, "c'est pas juste\ndu poisson cru")])


if __name__ == "__main__":
    unittest.main()
