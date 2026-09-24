"""Rendu graphique Tio Clem : cartes 1080x1920, vidéo H.264/AAC, cover, slides.

Tout est dessiné avec Pillow puis encodé par le ffmpeg fourni par imageio-ffmpeg
(libx264, AAC, libass pour l'incrustation des sous-titres).
"""
from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTS = ROOT / "assets" / "fonts"

W, H, FPS = 1080, 1920, 30

# Zones sûres TikTok : barre du haut, colonne d'icônes à droite,
# légende et boutons en bas. Aucun texte ne doit sortir de ce rectangle.
SAFE = (72, 200, 930, 1480)
SAFE_CX = (SAFE[0] + SAFE[2]) // 2

# Sous-titres incrustés : bas de la zone sûre.
SUB_MARGIN_V = H - SAFE[3]
SUB_FONT_SIZE = 56

PALETTES = {
    # nom: (haut du dégradé, bas du dégradé, texte, accent, fond du médaillon)
    "rojo":  ("#D91023", "#8E0B21", "#FFF6EA", "#F5B700", "#FFFFFF"),
    "crema": ("#FFF6EA", "#F4DFC2", "#1C1512", "#D91023", "#FFFFFF"),
    "ají":   ("#FFC21A", "#F09A00", "#1C1512", "#D91023", "#FFF6EA"),
    "selva": ("#1F7A56", "#0F4431", "#FFF6EA", "#F5B700", "#FFF6EA"),
    "mar":   ("#11587D", "#08304A", "#FFF6EA", "#F5B700", "#FFF6EA"),
}
PALETTES["aji"] = PALETTES["ají"]

EMOJI_CANDIDATES = [
    os.environ.get("TIOCLEM_EMOJI_FONT", ""),
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
    "/usr/share/fonts/noto/NotoColorEmoji.ttf",
    str(Path.home() / ".cache" / "tioclem" / "NotoColorEmoji.ttf"),
    "/System/Library/Fonts/Apple Color Emoji.ttc",
]

EMOJI_RE = re.compile(
    "(?:[\U0001F1E6-\U0001F1FF]{2})"               # drapeaux
    "|(?:[\U0001F000-\U0001FAFF☀-➿⭐⭕⌚-⏿]"
    "(?:️)?(?:‍[\U0001F000-\U0001FAFF☀-➿](?:️)?)*)"
)


def ffmpeg_exe() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    files = {
        "display": "Anton-Regular.ttf",
        "bold": "Montserrat-Bold.ttf",
        "semibold": "Montserrat-SemiBold.ttf",
        "extrabold": "Montserrat-ExtraBold.ttf",
    }
    return ImageFont.truetype(str(FONTS / files[name]), size)


_emoji_font = None


def emoji_font():
    global _emoji_font
    if _emoji_font is None:
        for path in EMOJI_CANDIDATES:
            if path and Path(path).exists():
                for size in (109, 160, 96):
                    try:
                        _emoji_font = ImageFont.truetype(path, size)
                        break
                    except OSError:
                        continue
            if _emoji_font:
                break
        if _emoji_font is None:
            _emoji_font = False
    return _emoji_font or None


def strip_emoji(text: str) -> str:
    return re.sub(r"\s{2,}", " ", EMOJI_RE.sub("", text).replace("️", "")).strip()


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- emoji & texte

def emoji_image(char: str, size: int) -> Image.Image | None:
    ef = emoji_font()
    if ef is None:
        return None
    probe = Image.new("RGBA", (ef.size * 4, ef.size * 2), (0, 0, 0, 0))
    ImageDraw.Draw(probe).text((ef.size // 2, ef.size // 4), char, font=ef, embedded_color=True)
    bbox = probe.getbbox()
    if not bbox:
        return None
    glyph = probe.crop(bbox)
    scale = size / max(glyph.size)
    return glyph.resize((max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))), Image.LANCZOS)


def split_runs(text: str):
    """Découpe un texte en segments texte / emoji."""
    pos = 0
    for m in EMOJI_RE.finditer(text):
        if m.start() > pos:
            yield ("text", text[pos:m.start()])
        yield ("emoji", m.group())
        pos = m.end()
    if pos < len(text):
        yield ("text", text[pos:])


def run_width(text: str, fnt) -> int:
    total = 0
    for kind, part in split_runs(text):
        total += int(fnt.size * 1.05) if kind == "emoji" else int(fnt.getlength(part))
    return total


def draw_rich(img: Image.Image, xy, text: str, fnt, fill) -> None:
    """Texte avec emoji en couleur, aligné à gauche à partir de xy (haut)."""
    x, y = xy
    d = ImageDraw.Draw(img)
    asc, _ = fnt.getmetrics()
    for kind, part in split_runs(text):
        if kind == "text":
            d.text((x, y), part, font=fnt, fill=fill)
            x += fnt.getlength(part)
        else:
            e = emoji_image(part, int(fnt.size * 0.95))
            if e is not None:
                img.alpha_composite(e, (int(x + fnt.size * 0.05), int(y + asc - e.height * 0.92)))
            x += int(fnt.size * 1.05)


def wrap(text: str, fnt, max_w: int) -> list[str]:
    if "\n" in text:  # retours à la ligne voulus : chaque paragraphe est coupé séparément
        return [l for part in text.split("\n") for l in wrap(part, fnt, max_w)]
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if run_width(trial, fnt) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if 1 < len(lines) <= 4 and len(words) <= 16:
        lines = balance(words, len(lines), fnt, max_w) or lines
    return lines


def balance(words, n, fnt, max_w):
    """Même nombre de lignes, mais la plus longue la plus courte possible."""
    from itertools import combinations
    best, best_w = None, None
    for cuts in combinations(range(1, len(words)), n - 1):
        bounds = (0, *cuts, len(words))
        cand = [" ".join(words[bounds[i]:bounds[i + 1]]) for i in range(n)]
        widest = max(run_width(c, fnt) for c in cand)
        if widest <= max_w and (best_w is None or widest < best_w):
            best, best_w = cand, widest
    return best


def fit_text(text: str, kind: str, max_w: int, max_lines: int, start: int, minimum: int):
    size = start
    while size > minimum:
        fnt = font(kind, size)
        lines = wrap(text, fnt, max_w)
        if len(lines) <= max_lines and all(run_width(l, fnt) <= max_w for l in lines):
            return fnt, lines
        size -= 4
    fnt = font(kind, minimum)
    return fnt, wrap(text, fnt, max_w)


def draw_block(img, text, kind, top, max_w, max_lines, start, minimum, fill, line_gap=1.08, cx=SAFE_CX):
    """Bloc centré ; renvoie (bas du bloc, bbox du bloc)."""
    fnt, lines = fit_text(text, kind, max_w, max_lines, start, minimum)
    lh = int(fnt.size * line_gap)
    y = top
    x_min, x_max = W, 0
    for line in lines:
        lw = run_width(line, fnt)
        x = cx - lw // 2
        draw_rich(img, (x, y), line, fnt, fill)
        x_min, x_max = min(x_min, x), max(x_max, x + lw)
        y += lh
    return y, (x_min, top, x_max, y)


# ---------------------------------------------------------------- cartes

def gradient(top: str, bottom: str) -> Image.Image:
    a, b = hex_rgb(top), hex_rgb(bottom)
    col = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / (H - 1)
        col.putpixel((0, y), tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    return col.resize((W, H)).convert("RGBA")


def andean_band(img: Image.Image, y: int, color, accent) -> None:
    """Frise en zigzag inspirée des textiles andins (décor, sans texte)."""
    d = ImageDraw.Draw(img)
    step, amp = 36, 14
    for offset, col in ((0, color), (18, accent)):
        pts = [(x, y + offset + (amp if (x // step) % 2 else -amp)) for x in range(-step, W + step, step)]
        d.line(pts, fill=col, width=6, joint="curve")


def media_background(path: Path, pal) -> Image.Image:
    photo = Image.open(path).convert("RGB")
    scale = max(W / photo.width, H / photo.height)
    photo = photo.resize((math.ceil(photo.width * scale), math.ceil(photo.height * scale)), Image.LANCZOS)
    left, top = (photo.width - W) // 2, (photo.height - H) // 2
    bg = photo.crop((left, top, left + W, top + H)).convert("RGBA")
    # voile sombre sur la moitié basse pour la lisibilité
    veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)
    for y in range(H // 3, H):
        a = int(200 * (y - H // 3) / (H - H // 3))
        vd.line([(0, y), (W, y)], fill=(0, 0, 0, a))
    return Image.alpha_composite(bg, veil)


def brand_tag(img: Image.Image, pal) -> tuple:
    text, accent = "TIO CLEM 🇵🇪", hex_rgb(pal[3])
    fnt = font("extrabold", 34)
    tw = run_width(text, fnt)
    x, y = SAFE[0], SAFE[1] + 24
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, y, x + tw + 44, y + 62), radius=31, fill=(*hex_rgb(pal[2]), 235))
    draw_rich(img, (x + 22, y + 11), text, fnt, hex_rgb(pal[0]) if pal[0] != "#FFF6EA" else accent)
    return (x, y, x + tw + 44, y + 62)


def render_card(card: dict, media: Path | None = None) -> tuple[Image.Image, Image.Image, list]:
    """Renvoie (fond, calque texte RGBA, liste des bbox de texte).

    card : title, subtitle, emoji (médaillon), number, palette, badge_emoji, big (cover)
    """
    pal = PALETTES.get(card.get("palette", "rojo"), PALETTES["rojo"])
    text_col, accent = hex_rgb(pal[2]), hex_rgb(pal[3])
    boxes = []

    if media and media.exists():
        bg = media_background(media, pal)
        text_col, accent = (255, 246, 234), hex_rgb("#F5B700")
        has_photo = True
    else:
        bg = gradient(pal[0], pal[1])
        andean_band(bg, 150, (*accent, 255), (*text_col, 120))
        andean_band(bg, 1560, (*accent, 255), (*text_col, 120))
        has_photo = False

    fg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    boxes.append(("brand", brand_tag(fg, pal)))

    big = card.get("big", False)
    if not has_photo:
        cy, r = (640, 250) if big else (600, 225)
        medal = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        md = ImageDraw.Draw(medal)
        md.ellipse((SAFE_CX - r + 14, cy - r + 22, SAFE_CX + r + 14, cy + r + 22), fill=(0, 0, 0, 60))
        medal = medal.filter(ImageFilter.GaussianBlur(10))
        md = ImageDraw.Draw(medal)
        md.ellipse((SAFE_CX - r, cy - r, SAFE_CX + r, cy + r), fill=(*hex_rgb(pal[4]), 255))
        md.ellipse((SAFE_CX - r + 16, cy - r + 16, SAFE_CX + r - 16, cy + r - 16), outline=(*accent, 255), width=8)
        bg = Image.alpha_composite(bg, medal)
        e = emoji_image(card.get("emoji", "🇵🇪"), int(r * 1.15))
        if e is not None:
            bg.alpha_composite(e, (SAFE_CX - e.width // 2, cy - e.height // 2))
        title_top = cy + r + 60
    else:
        title_top = 860

    number = card.get("number")
    if number is not None:
        nf = font("display", 120)
        label = f"#{number}"
        d = ImageDraw.Draw(fg)
        nw = int(nf.getlength(label))
        nx, ny = SAFE[0] + 24, (title_top - 150) if has_photo else 330
        d.rounded_rectangle((nx - 20, ny + 10, nx + nw + 20, ny + 150), radius=24, fill=(*accent, 255))
        d.text((nx, ny), label, font=nf, fill=hex_rgb(pal[0]) if not has_photo else (28, 21, 18))
        boxes.append(("number", (nx - 20, ny + 10, nx + nw + 20, ny + 150)))

    title = card.get("title", "")
    if card.get("badge_emoji"):
        title = f"{title} {card['badge_emoji']}"
    bottom, bb = draw_block(
        fg, title, "display", title_top, SAFE[2] - SAFE[0] - 30,
        4 if big else 2, 150 if big else 128, 72, text_col, line_gap=1.12)
    boxes.append(("title", bb))

    if card.get("subtitle"):
        _, sb = draw_block(fg, card["subtitle"], "bold", bottom + 18, SAFE[2] - SAFE[0] - 40,
                           2, 46, 32, accent)
        boxes.append(("subtitle", sb))

    if card.get("body"):
        # le corps rétrécit jusqu'à tenir au-dessus du bas de la zone sûre
        for size in range(52, 29, -2):
            trial = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            _, bb2 = draw_block(trial, card["body"], "semibold", bottom + 30, SAFE[2] - SAFE[0] - 40,
                                8, size, size, text_col, line_gap=1.3)
            if bb2[3] <= SAFE[3]:
                break
        fg.alpha_composite(trial)
        boxes.append(("body", bb2))

    return bg, fg, boxes


def flatten(bg: Image.Image, fg: Image.Image) -> Image.Image:
    return Image.alpha_composite(bg, fg).convert("RGB")


# ---------------------------------------------------------------- animation

def ease_out_back(t: float) -> float:
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def frame_at(bg, fg, t, dur, animation: str) -> Image.Image:
    frame = bg
    if "zoom" in animation:
        s = 1 + 0.06 * (t / max(dur, 0.01))
        zw, zh = round(W * s), round(H * s)
        z = bg.resize((zw, zh), Image.BILINEAR)
        l, tp = (zw - W) // 2, (zh - H) // 2
        frame = z.crop((l, tp, l + W, tp + H))
    else:
        frame = bg.copy()
    layer = fg
    if "pop" in animation and t < 0.35:
        p = t / 0.35
        s = 0.86 + 0.14 * ease_out_back(p)
        lw, lh = round(W * s), round(H * s)
        scaled = fg.resize((lw, lh), Image.BILINEAR)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        cx, cy = SAFE_CX, 1050
        layer.alpha_composite(scaled, (round(cx - cx * s), round(cy - cy * s)))
        alpha = layer.getchannel("A").point(lambda a: int(a * min(1, p * 1.6)))
        layer.putalpha(alpha)
    elif t < 0.12:
        layer = fg.copy()
        layer.putalpha(fg.getchannel("A").point(lambda a: int(a * t / 0.12)))
    return Image.alpha_composite(frame, layer).convert("RGB")


# ---------------------------------------------------------------- sous-titres

def ass_time(t: float) -> str:
    cs = round(t * 100)
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def write_ass(cues, path: Path) -> None:
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TioClem,Montserrat ExtraBold,{SUB_FONT_SIZE},&H00FFFFFF,&H00FFFFFF,&H00141414,&H64000000,0,0,0,0,100,100,0,0,1,7,2,2,{SAFE[0]},{W - SAFE[2]},{SUB_MARGIN_V},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    for start, end, text in cues:
        txt = strip_emoji(text).replace("\n", "\\N")
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},TioClem,,0,0,0,,{txt}\n")
    path.write_text("".join(lines), encoding="utf-8")


# ---------------------------------------------------------------- vidéo

def detect_silences(path: Path, noise_db: int = -35, min_len: float = 0.2) -> list[tuple[float, float]]:
    """Pauses de la voix off, en secondes (début, fin)."""
    out = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path), "-af",
                          f"silencedetect=n={noise_db}dB:d={min_len}", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    return list(zip(starts, ends))


def probe_duration(path: Path) -> float:
    out = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    if not m:
        raise RuntimeError(f"durée illisible : {path}")
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def render_video(scenes: list[dict], cues, out: Path, voice: Path | None = None) -> None:
    """scenes : [{bg, fg, duration, animation}] ; cues : [(start, end, text)]."""
    total = sum(s["duration"] for s in scenes)
    tmp = Path(tempfile.mkdtemp(prefix="tioclem-"))
    ass = tmp / "subs.ass"
    write_ass(cues, ass)
    ass_arg = str(ass).replace("\\", "/").replace(":", "\\:")
    fonts_arg = str(FONTS).replace("\\", "/").replace(":", "\\:")
    cmd = [ffmpeg_exe(), "-y", "-hide_banner", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if voice and voice.exists():
        # voix off : coupe les graves parasites, niveau TikTok (-14 LUFS), stéréo
        cmd += ["-i", str(voice), "-af", "highpass=f=80,loudnorm=I=-14:TP=-1.5:LRA=11,apad", "-ac", "2"]
    else:
        cmd += ["-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=44100:cl=stereo"]
    cmd += ["-vf", f"subtitles=filename='{ass_arg}':fontsdir='{fonts_arg}'",
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
            "-r", str(FPS), "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
            "-t", f"{total:.3f}", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        for sc in scenes:
            n = round(sc["duration"] * FPS)
            for i in range(n):
                proc.stdin.write(frame_at(sc["bg"], sc["fg"], i / FPS, sc["duration"], sc["animation"]).tobytes())
    finally:
        proc.stdin.close()
        code = proc.wait()
        shutil.rmtree(tmp, ignore_errors=True)
    if code != 0:
        raise RuntimeError(f"ffmpeg a échoué (code {code})")


def video_info(path: Path) -> dict:
    out = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True).stderr
    info = {"duration": probe_duration(path)}
    v = re.search(r"Video: (\w+).*?, (\d{2,5})x(\d{2,5})", out)
    fps = re.search(r"([\d.]+) fps", out)
    a = re.search(r"Audio: (\w+)", out)
    if v:
        info.update(vcodec=v.group(1), width=int(v.group(2)), height=int(v.group(3)))
    if fps:
        info["fps"] = float(fps.group(1))
    if a:
        info["acodec"] = a.group(1)
    return info
