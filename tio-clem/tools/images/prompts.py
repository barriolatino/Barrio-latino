"""Prompts d'images générées (Mode B), cadrés pour un Pérou réaliste et respectueux.

Chaque asset généré est enregistré avec son prompt complet (voir providers.py).
"""
from __future__ import annotations

STYLE = ("Documentary-style vertical photograph, natural light, warm and colorful but not oversaturated, "
         "realistic textures, shot on a 35mm lens, shallow depth of field, authentic everyday setting in Peru.")

RULES = [
    "realistic and culturally accurate Peruvian details",
    "architecture, landscapes and clothing consistent with the region shown",
    "realistic food, served as it is in Peru",
    "no text, letters, signs or logos anywhere in the image",
    "no flags unless explicitly requested",
    "no clichés (no sombreros, no generic 'Latin' props), no caricature",
    "no visible AI artifacts, no extra fingers, no distorted faces",
    "leave calm space in the lower third for subtitles",
]


def build(visual: dict, post: dict) -> dict:
    """Prompt pour une scène ou une slide. `visual` : need, description (en français)."""
    subject = visual.get("prompt_en") or f"{visual.get('need', '')}. {visual.get('description', '')}".strip(". ")
    region = post.get("visual_region")
    where = f" Location: {region}, Peru." if region else ""
    prompt = f"{STYLE} Subject: {subject}.{where} Constraints: " + "; ".join(RULES) + "."
    return {"prompt": prompt, "subject_fr": subject, "rules": RULES, "size": "1024x1536"}
