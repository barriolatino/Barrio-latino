"""Visuels : choix de l'image de chaque scène ou slide, et génération (Mode B).

Ordre de priorité pour une scène :
1. photo de Tio Clem  : assets/images/posts/day-NN/<scene>.jpg
2. image sourcée (Mode A) enregistrée dans assets/images/sourced/manifest.json
3. image générée (Mode B), si la scène le demande (`visual.asset_type: "generated"`)
   et que IMAGE_PROVIDER est configuré ; gardée dans assets/images/generated/ avec son prompt
4. carte graphique Tio Clem (aucun coût)

| IMAGE_PROVIDER | Rôle | Testé en réel |
|---|---|---|
| none | pas de génération : cartes Tio Clem, photos et images sourcées | oui |
| mock | image de test marquée « MOCK », **jamais publiable** | oui |
| openai | API OpenAI /v1/images/generations | non (API injoignable ici) |
"""
from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

import env
import net
from images import prompts, sourced

ROOT = Path(__file__).resolve().parents[2]
OWN = ROOT / "assets" / "images" / "posts"
GENERATED = ROOT / "assets" / "images" / "generated"


class MockImages:
    name, is_mock, tested_live = "mock", True, True

    def generate(self, prompt: str, out: Path) -> dict:
        img = Image.new("RGB", (1024, 1536), (90, 90, 90))
        d = ImageDraw.Draw(img)
        for i in range(-1536, 1024, 90):
            d.line([(i, 0), (i + 1536, 1536)], fill=(120, 120, 120), width=24)
        from PIL import ImageFont
        big = ImageFont.load_default(size=150)
        for y in (120, 560, 1000):  # marquage répété : visible même sous un titre
            d.rectangle((0, y, 1024, y + 260), fill=(200, 0, 0))
            d.text((512, y + 70), "MOCK", fill="white", font=big, anchor="mt")
            d.text((512, y + 215), "NE PAS PUBLIER", fill="white", font=ImageFont.load_default(size=40), anchor="mt")
        img.save(out, quality=90)
        return {"provider": self.name}


class OpenAIImages:
    name, is_mock, tested_live = "openai", False, False
    URL = "https://api.openai.com/v1/images/generations"

    def generate(self, prompt: str, out: Path) -> dict:
        key = env.require("OPENAI_API_KEY", "images openai")
        model = env.get("IMAGE_MODEL", "gpt-image-1")
        quality = env.get("IMAGE_QUALITY", "medium")
        data = json.loads(net.post_json(self.URL, {"Authorization": f"Bearer {key}"},
                                        {"model": model, "prompt": prompt, "n": 1, "size": "1024x1536",
                                         "quality": quality, "output_format": "jpeg"}))
        try:
            out.write_bytes(base64.b64decode(data["data"][0]["b64_json"]))
        except (KeyError, IndexError, TypeError) as e:
            raise net.ProviderError(f"réponse inattendue d'OpenAI : {str(data)[:200]}") from e
        return {"provider": self.name, "model": model, "quality": quality}


PROVIDERS = {"mock": MockImages, "openai": OpenAIImages}


def provider_name() -> str:
    return "mock" if env.mock_enabled() else env.get("IMAGE_PROVIDER", "none")


def get_provider(name: str | None = None):
    name = name or provider_name()
    if name in ("", "none"):
        return None
    if name not in PROVIDERS:
        raise env.MissingConfig(f"IMAGE_PROVIDER inconnu : {name} (choix : none, {', '.join(PROVIDERS)})")
    return PROVIDERS[name]()


def _own(day: int, unit_id: str) -> Path | None:
    for ext in ("jpg", "jpeg", "png", "webp"):
        p = OWN / f"day-{day:02d}" / f"{unit_id}.{ext}"
        if p.exists():
            return p
    return None


def resolve(post: dict, unit: dict, provider=None) -> tuple[Path | None, dict]:
    """Image à utiliser pour une scène ou une slide, et sa fiche (type, source, licence ou prompt)."""
    day, uid = post["day"], unit["id"]
    own = _own(day, uid)
    if own:
        return own, {"type": "own", "file": str(own.relative_to(ROOT)), "license": "own", "mock": False}
    src = sourced.find(day, uid)
    if src:
        return ROOT / src["file"], {"type": "sourced", **src, "mock": False}
    visual = unit.get("visual", unit)
    if visual.get("asset_type") != "generated":
        return None, {"type": "card", "mock": False}
    provider = provider if provider is not None else get_provider()
    if provider is None:
        return None, {"type": "card", "mock": False, "note": "génération demandée mais IMAGE_PROVIDER=none"}
    p = prompts.build(visual, post)
    digest = hashlib.sha256(f"{provider.name}|{p['prompt']}".encode()).hexdigest()[:16]
    folder = GENERATED / f"day-{day:02d}"
    folder.mkdir(parents=True, exist_ok=True)
    img, meta_file = folder / f"{uid}.{provider.name}.jpg", folder / f"{uid}.{provider.name}.json"
    if img.exists() and meta_file.exists() and json.loads(meta_file.read_text())["hash"] == digest:
        return img, {**json.loads(meta_file.read_text()), "cached": True}
    info = provider.generate(p["prompt"], img)
    meta = {"type": "generated", **info, "mock": provider.is_mock, "tested_live": provider.tested_live,
            "hash": digest, "file": str(img.relative_to(ROOT)), "prompt": p["prompt"], "subject_fr": p["subject_fr"]}
    meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return img, meta
