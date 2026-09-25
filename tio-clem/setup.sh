#!/usr/bin/env bash
# Installe les dépendances de la Content Factory Tio Clem (idempotent).
set -euo pipefail
cd "$(dirname "$0")"
python3 -m pip install --quiet -r requirements.txt
python3 - <<'PY'
from PIL import features
import imageio_ffmpeg, subprocess
exe = imageio_ffmpeg.get_ffmpeg_exe()
enc = subprocess.run([exe, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
flt = subprocess.run([exe, "-hide_banner", "-filters"], capture_output=True, text=True).stdout
print("ffmpeg        :", exe)
print("libx264 / aac :", "libx264" in enc, "/", " aac " in enc)
print("libass        :", " subtitles " in flt)
print("raqm (emoji)  :", features.check("raqm"))
import sys; sys.path.insert(0, "tools"); import render
print("police emoji  :", bool(render.emoji_font()) or "absente : définir TIOCLEM_EMOJI_FONT (NotoColorEmoji.ttf)")
PY
