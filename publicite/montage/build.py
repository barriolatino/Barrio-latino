"""Montage v1 du spot « Mercredi Tacos » (30 s, 1080x1920, 30 i/s).

Sources : la photo produit (reference-tacos.png) et la vidéo du restaurant
(frames extraites et tone-mappées HLG -> SDR dans SRC_DIR).
Usage : python3 build.py <src_dir> <fonts_dir> <ffmpeg> <sortie.mp4>
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC_DIR, FONTS, FFMPEG, OUT = (Path(a) for a in sys.argv[1:5])
HERE = Path(__file__).resolve().parent
W, H, FPS = 1080, 1920, 30

NAVY = (18, 23, 58)
CREAM = (251, 243, 229)
SUN = (242, 129, 29)
CORAL_DEEP = (221, 55, 29)

PHOTO = Image.open(HERE.parent / "reference-tacos.png").convert("RGB")


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


EMOJI = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf", 109)


def emoji_img(ch, height):
    im = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((0, 0), ch, font=EMOJI, embedded_color=True)
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- sources

def photo_crop(cx, cy, cw):
    """Recadrage 9:16 sub-pixel de la photo, centré (cx, cy), largeur cw."""
    ch = cw * 16 / 9
    x0, y0 = cx - cw / 2, cy - ch / 2
    x0 = min(max(x0, 0), PHOTO.width - cw)
    y0 = min(max(y0, 0), PHOTO.height - ch)
    return PHOTO.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch),
                           Image.BICUBIC)


def kb(a, b):
    """Plan photo : interpolation (cx, cy, cw) de a vers b."""
    def f(t):
        e = ease(t)
        return photo_crop(*(a[i] + (b[i] - a[i]) * e for i in range(3)))
    return f


def src_frame(i, crop=None):
    im = Image.open(SRC_DIR / f"{i:04d}.jpg").convert("RGB")
    if crop:
        im = im.crop(crop).resize((W, H), Image.LANCZOS)
    return im


def clip(first, last, crop=None, repeat=1):
    frames = [n for n in range(first, last + 1) for _ in range(repeat)]

    def f(t, n=len(frames)):
        return src_frame(frames[min(int(t * n), n - 1)], crop)
    return len(frames), f


_blur_cache = {}


def blurred_terrace(t):
    if "bg" not in _blur_cache:
        bg = src_frame(260).filter(ImageFilter.GaussianBlur(38))
        _blur_cache["bg"] = Image.blend(bg, Image.new("RGB", bg.size, (0, 0, 0)), 0.38)
    bg = _blur_cache["bg"]
    s = 1.0 + 0.04 * ease(t)
    w, h = W / s, H / s
    return bg.transform((W, H), Image.EXTENT,
                        ((W - w) / 2, (H - h) / 2, (W + w) / 2, (H + h) / 2),
                        Image.BICUBIC)


# ---------------------------------------------------------------- overlays

def gradient(top_rgba, bottom_alpha, y0, y1):
    """Calque vertical : couleur top_rgba de y0 vers transparent en y1."""
    a = np.zeros((H, 1), dtype=np.float32)
    ys = np.arange(H)
    a[:, 0] = np.clip((y1 - ys) / (y1 - y0), 0, 1) ** 1.4 * top_rgba[3]
    a[ys < y0, 0] = top_rgba[3]
    layer = np.zeros((H, W, 4), dtype=np.uint8)
    layer[..., :3] = top_rgba[:3]
    layer[..., 3] = np.repeat(a, W, axis=1).astype(np.uint8)
    return Image.fromarray(layer, "RGBA")


TOP_DARK = gradient((0, 0, 0, 120), 0, 0, 900)
TOP_PAPER = gradient((255, 253, 248, 245), 0, 360, 1180)


def text_layer(txt, fnt, color, tracking=0, shadow=False, emoji=None):
    """Rend une ligne de texte (+ emoji optionnel) sur un calque RGBA ajusté."""
    asc, desc = fnt.getmetrics()
    widths = [fnt.getlength(c) + tracking for c in txt]
    tw = int(sum(widths) - tracking) if txt else 0
    em = emoji_img(emoji, int(asc * 0.92)) if emoji else None
    gap = int(asc * 0.28) if em and txt else 0
    total = tw + gap + (em.width if em else 0)
    pad = 40
    im = Image.new("RGBA", (total + 2 * pad, asc + desc + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = pad
    for c, w in zip(txt, widths):
        d.text((x, pad), c, font=fnt, fill=color)
        x += w
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        mask = im.split()[3].filter(ImageFilter.GaussianBlur(10))
        sh.putalpha(mask.point(lambda v: int(v * 0.45)))
        sh = Image.alpha_composite(sh, im)
        im = sh
    if em:
        im.alpha_composite(em, (pad + tw + gap, pad + (asc - em.height) // 2 + 4))
    return im


class Title:
    def __init__(self, layer, y, t_in, t_out=None, scale_in=False):
        self.layer, self.y, self.t_in, self.t_out = layer, y, t_in, t_out
        self.scale_in = scale_in

    def draw(self, frame, t):
        if t < self.t_in or (self.t_out is not None and t >= self.t_out):
            return
        k = ease((t - self.t_in) / (8 / FPS))
        if self.t_out is not None:
            k = min(k, ease((self.t_out - t) / (6 / FPS)))
        lay = self.layer
        if self.scale_in:
            s = 0.94 + 0.06 * k
            lay = lay.resize((round(lay.width * s), round(lay.height * s)),
                             Image.LANCZOS)
        a = lay.split()[3].point(lambda v: int(v * k))
        lay = lay.copy()
        lay.putalpha(a)
        dy = int(18 * (1 - k))
        frame.alpha_composite(lay, ((W - lay.width) // 2,
                                    self.y - lay.height // 2 + dy))


# ---------------------------------------------------------------- timeline

B_XB = "Baloo2-ExtraBold.ttf"
B_SB = "Baloo2-SemiBold.ttf"
WS_M = "WorkSans-Medium.ttf"
WS_SB = "WorkSans-SemiBold.ttf"

shots = []  # (nb_images, fonction(t)->Image RGB, calques, titres)


def add(n, fn, overlays=(), titles=()):
    shots.append((n, fn, list(overlays), list(titles)))


# 1 · Hook (0-3 s)
add(90, kb((855, 561, 631), (868, 655, 470)), [TOP_DARK], [
    Title(text_layer("ENVIE D'UN TACOS ?", font(B_XB, 96), CREAM, 1, True, "🌮"),
          470, 0.15)])
# 2-5 · Le lieu (le chevalet, la salle, le néon)
add(*clip(205, 241, crop=(590, 1049, 1080, 1920)))
add(*clip(16, 30))
add(*clip(32, 45))
add(*clip(165, 201))
# 6-11 · Montage food (plans macro dans la photo)
add(39, kb((862, 648, 455), (882, 668, 430)))
add(36, kb((815, 505, 470), (852, 500, 470)))
add(36, kb((612, 560, 440), (618, 552, 410)))
add(36, kb((1080, 520, 430), (1088, 492, 430)))
add(36, kb((800, 395, 470), (832, 390, 455)))
add(60, kb((850, 610, 520), (855, 561, 631)))
# 12-15 · La vie du restaurant
add(*clip(46, 59))
add(*clip(61, 71))
add(*clip(73, 79, repeat=2))
add(*clip(1, 14))
# 16 · L'offre (hero)
offer = [
    Title(text_layer("TOUS LES MERCREDIS", font(B_XB, 70), NAVY, 3, emoji="🌮"),
          360, 0.25),
    Title(text_layer("TORTILLA DE TACOS", font(B_SB, 62), NAVY, 2), 455, 0.55),
    Title(text_layer("3,50 €", font(B_XB, 210), CORAL_DEEP), 640, 0.95,
          scale_in=True),
]
add(150, kb((866, 561, 631), (866, 600, 580)), [TOP_PAPER], offer)
# 17 · Le lieu + l'adresse
add(105, blurred_terrace, [], [
    Title(text_layer("BARRIO LATINO", font(B_XB, 118), CREAM, 4, True), 640, 0.2),
    Title(text_layer("9 rue du Port", font(WS_SB, 56), CREAM, 1, True), 790, 0.55),
    Title(text_layer("63000 Clermont-Ferrand", font(WS_M, 46), CREAM, 1, True),
          862, 0.7),
])
# 18 · Fin : rappel de l'offre + question
add(156, kb((855, 575, 600), (855, 561, 631)), [TOP_PAPER], [
    Title(text_layer("On se retrouve mercredi ?", font(B_XB, 76), NAVY, 0,
                     emoji="🌮"), 360, 0.2),
    Title(text_layer("Tortilla de tacos 3,50 € · tous les mercredis",
                     font(WS_SB, 38), CORAL_DEEP), 452, 0.6),
    Title(text_layer("BARRIO LATINO · 9 rue du Port · Clermont-Ferrand",
                     font(WS_M, 32), NAVY, 1), 1215, 1.0),
])

total = sum(s[0] for s in shots)
assert total == 30 * FPS, total

# ---------------------------------------------------------------- rendu

enc = subprocess.Popen([
    str(FFMPEG), "-v", "error", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
    "-i", "-",
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-vf", "unsharp=5:5:0.35,noise=c0s=5:c0f=t,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
    str(OUT)], stdin=subprocess.PIPE)

for n, fn, overlays, titles in shots:
    for i in range(n):
        t = i / n
        frame = fn(t).convert("RGBA")
        for ov in overlays:
            frame.alpha_composite(ov)
        for ti in titles:
            ti.draw(frame, i / FPS)
        enc.stdin.write(frame.convert("RGB").tobytes())
enc.stdin.close()
sys.exit(enc.wait())
