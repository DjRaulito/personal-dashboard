"""Efectos del VoiceStudio: fondos animados generados, rótulos con emojis que saltan, destellos en
los cortes, barra de progreso, música generada y efectos de sonido. Todo se crea aquí (sin
licencias de terceros salvo los emojis de Twemoji, CC-BY 4.0)."""

from __future__ import annotations

import math
import subprocess
import urllib.request
import wave
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FPS = 30
SR = 44100

# ---------------------------------------------------------------------------
# Paletas: acentos vivos pero no neón, sobre fondos oscuros
# ---------------------------------------------------------------------------


@dataclass
class Palette:
    accents: list[tuple[int, int, int]]
    dark: tuple[int, int, int]
    glows: list[tuple[int, int, int]]
    ink: tuple[int, int, int] = (17, 17, 20)


PALETTES = [
    Palette([(246, 190, 72), (240, 120, 92)], (14, 13, 20), [(92, 52, 140), (196, 92, 70), (40, 70, 140)]),
    Palette([(108, 212, 168), (110, 176, 246)], (10, 16, 22), [(24, 110, 110), (40, 72, 160), (70, 40, 120)]),
    Palette([(255, 140, 120), (186, 150, 244)], (18, 12, 22), [(150, 50, 90), (80, 50, 160), (190, 100, 60)]),
    Palette([(250, 214, 92), (122, 190, 255)], (12, 14, 24), [(30, 60, 150), (140, 90, 30), (20, 110, 130)]),
]


def palette_for(seed: int) -> Palette:
    return PALETTES[seed % len(PALETTES)]


def bgr_hex(rgb: tuple[int, int, int]) -> str:
    """Color para ASS (&HBBGGRR&)."""
    r, g, b = rgb
    return f"&H{b:02X}{g:02X}{r:02X}&"


# ---------------------------------------------------------------------------
# Curvas de animación
# ---------------------------------------------------------------------------


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def ease_out_back(t: float) -> float:
    c1 = 1.70158
    c3 = c1 + 1
    t = clamp(t)
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def ease_out_cubic(t: float) -> float:
    return 1 - (1 - clamp(t)) ** 3


# ---------------------------------------------------------------------------
# Fondo animado generado (cuando no hay clip ni imagen)
# ---------------------------------------------------------------------------


def procedural_background(out: Path, width: int, height: int, seconds: float, seed: int, pal: Palette) -> None:
    """Manchas de luz que se mueven despacio, partículas que suben y grano fino. Se calcula a 1/4 de
    resolución (barato) y ffmpeg lo escala: el desenfoque del escalado le da el aspecto de bokeh."""
    lw, lh = width // 4, height // 4
    rnd = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:lh, 0:lw].astype(np.float32)
    dim = float(min(lw, lh))
    base = np.array(pal.dark, dtype=np.float32)

    blobs = []
    for k in range(4):
        color = np.array(pal.glows[k % len(pal.glows)] if k < 3 else pal.accents[0], dtype=np.float32)
        strength = 0.85 if k < 3 else 0.35
        blobs.append(
            dict(
                color=color * strength,
                radius=dim * rnd.uniform(0.45, 0.8),
                ax=rnd.uniform(0.25, 0.45),
                ay=rnd.uniform(0.25, 0.45),
                wx=rnd.uniform(0.08, 0.2) * rnd.choice([-1, 1]),
                wy=rnd.uniform(0.06, 0.16) * rnd.choice([-1, 1]),
                px=rnd.uniform(0, 6.28),
                py=rnd.uniform(0, 6.28),
            )
        )
    n = 46
    part_x = rnd.uniform(0, lw, n)
    part_y = rnd.uniform(0, lh, n)
    part_v = rnd.uniform(3, 12, n)  # px/s a baja resolución
    part_s = rnd.uniform(0.6, 1.8, n)
    part_b = rnd.uniform(60, 190, n)
    part_phase = rnd.uniform(0, 6.28, n)
    stamp_r = 4
    sy, sx = np.mgrid[-stamp_r : stamp_r + 1, -stamp_r : stamp_r + 1].astype(np.float32)

    proc = subprocess.Popen(
        [
            "ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{lw}x{lh}",
            "-r", str(FPS), "-i", "-",
            "-vf", f"scale={width}:{height}:flags=bicubic,noise=alls=7:allf=t,format=yuv420p,setsar=1",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(out),
        ],
        stdin=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    frames = max(int(round(seconds * FPS)), 1)
    try:
        for f in range(frames):
            t = f / FPS + (seed % 997) * 3.1
            img = np.broadcast_to(base, (lh, lw, 3)).copy()
            for b in blobs:
                cx = lw * (0.5 + b["ax"] * math.sin(b["wx"] * t + b["px"]))
                cy = lh * (0.5 + b["ay"] * math.sin(b["wy"] * t + b["py"]))
                d2 = (xx - cx) ** 2 + (yy - cy) ** 2
                img += b["color"] * np.exp(-d2 / (b["radius"] ** 2))[..., None]
            tt = f / FPS
            for i in range(n):
                y = (part_y[i] - part_v[i] * tt) % lh
                x = (part_x[i] + 3 * math.sin(tt * 0.8 + part_phase[i])) % lw
                x0, y0 = int(x), int(y)
                if x0 - stamp_r < 0 or y0 - stamp_r < 0 or x0 + stamp_r >= lw or y0 + stamp_r >= lh:
                    continue
                twinkle = 0.65 + 0.35 * math.sin(tt * 2.3 + part_phase[i])
                g = np.exp(-((sx - (x - x0)) ** 2 + (sy - (y - y0)) ** 2) / (part_s[i] ** 2)) * part_b[i] * twinkle
                img[y0 - stamp_r : y0 + stamp_r + 1, x0 - stamp_r : x0 + stamp_r + 1] += g[..., None]
            proc.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
        proc.stdin.close()
    except BrokenPipeError:
        pass
    err = proc.stderr.read().decode(errors="ignore")
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg falló: {err[-600:]}")


# ---------------------------------------------------------------------------
# Emojis (Twemoji, CC-BY 4.0)
# ---------------------------------------------------------------------------

TWEMOJI = "https://raw.githubusercontent.com/jdecked/twemoji/v15.1.0/assets"


def emoji_code(emoji: str) -> str:
    points = [f"{ord(c):x}" for c in emoji.strip()]
    if "200d" not in points:
        points = [p for p in points if p != "fe0f"]
    return "-".join(points)


def emoji_image(emoji: str, size: int, cache: Path) -> Image.Image | None:
    """Emoji en PNG a `size` px. SVG con cairosvg si está; si no, el PNG de 72 px ampliado."""
    if not emoji or not emoji.strip():
        return None
    code = emoji_code(emoji)
    cache.mkdir(parents=True, exist_ok=True)
    png = cache / f"{code}-{size}.png"
    if png.exists():
        return Image.open(png).convert("RGBA")
    try:
        import cairosvg

        svg = cache / f"{code}.svg"
        if not svg.exists():
            _fetch(f"{TWEMOJI}/svg/{code}.svg", svg)
        cairosvg.svg2png(url=str(svg), write_to=str(png), output_width=size, output_height=size)
        return Image.open(png).convert("RGBA")
    except Exception:
        pass
    try:
        small = cache / f"{code}-72.png"
        if not small.exists():
            _fetch(f"{TWEMOJI}/72x72/{code}.png", small)
        img = Image.open(small).convert("RGBA").resize((size, size), Image.LANCZOS)
        img.save(png)
        return img
    except Exception:
        return None


def _fetch(url: str, out: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "personal-dashboard-studio"})
    with urllib.request.urlopen(req, timeout=20) as res:
        out.write_bytes(res.read())


# ---------------------------------------------------------------------------
# Rótulos
# ---------------------------------------------------------------------------


def fit_font(path: Path, text: str, size: int, max_width: int) -> ImageFont.FreeTypeFont:
    while size > 24:
        font = ImageFont.truetype(str(path), size)
        if font.getbbox(text)[2] <= max_width:
            return font
        size = int(size * 0.92)
    return ImageFont.truetype(str(path), size)


def wrap_lines(text: str, font_path: Path, size: int, max_width: int, max_lines: int = 3) -> tuple[list[str], ImageFont.FreeTypeFont]:
    """Parte el texto en líneas que quepan; si no cabe en `max_lines`, reduce la letra."""
    words = text.split()
    while True:
        font = ImageFont.truetype(str(font_path), size)
        lines: list[str] = []
        current = ""
        for w in words:
            trial = f"{current} {w}".strip()
            if font.getbbox(trial)[2] <= max_width or not current:
                current = trial
            else:
                lines.append(current)
                current = w
        if current:
            lines.append(current)
        widest = max((font.getbbox(l)[2] for l in lines), default=0)
        if (len(lines) <= max_lines and widest <= max_width) or size <= 28:
            return lines, font
        size = int(size * 0.9)


def callout_sprite(text: str, font_path: Path, size: int, max_width: int, fill, ink, outline: bool = False) -> Image.Image:
    """Pastilla redondeada con sombra y texto grande (estilo rótulo de redes)."""
    lines, font = wrap_lines(text, font_path, size, max_width - size)
    ascent, descent = font.getmetrics()
    line_h = int((ascent + descent) * 0.98)
    widths = [font.getbbox(l)[2] for l in lines]
    pad_x, pad_y = int(font.size * 0.45), int(font.size * 0.22)
    box_w = max(widths) + 2 * pad_x
    box_h = line_h * len(lines) + 2 * pad_y
    shadow = int(font.size * 0.18)
    margin = shadow * 3
    img = Image.new("RGBA", (box_w + 2 * margin, box_h + 2 * margin), (0, 0, 0, 0))

    shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shade).rounded_rectangle(
        (margin, margin + shadow, margin + box_w, margin + box_h + shadow), radius=int(font.size * 0.3), fill=(0, 0, 0, 150)
    )
    img = Image.alpha_composite(img, shade.filter(ImageFilter.GaussianBlur(shadow)))
    draw = ImageDraw.Draw(img)
    if fill is not None:
        draw.rounded_rectangle((margin, margin, margin + box_w, margin + box_h), radius=int(font.size * 0.3), fill=fill)
    y = margin + pad_y
    for line, w in zip(lines, widths):
        x = margin + (box_w - w) // 2
        draw.text(
            (x, y - int(font.size * 0.02)),
            line,
            font=font,
            fill=ink,
            stroke_width=max(2, font.size // 14) if outline else 0,
            stroke_fill=(0, 0, 0, 255),
        )
        y += line_h
    return img


# ---------------------------------------------------------------------------
# Capa de gráficos animados (se compone encima del vídeo)
# ---------------------------------------------------------------------------


@dataclass
class Sprite:
    image: Image.Image
    start: float
    end: float
    cx: float  # centro, en píxeles
    cy: float
    tilt: float = 0.0
    wobble: float = 0.0  # grados de balanceo mientras está en pantalla
    pop: float = 0.35  # duración de la entrada


@dataclass
class OverlayPlan:
    width: int
    height: int
    total: float
    sprites: list[Sprite] = field(default_factory=list)
    flashes: list[float] = field(default_factory=list)  # instantes de corte de escena


def plan_overlay(scenes: list[dict], starts: list[float], durations: list[float], width: int, height: int,
                 total: float, pal: Palette, fonts: Path, emoji_cache: Path, hook: str | None) -> OverlayPlan:
    """Decide qué rótulo y emoji sale en cada escena y cuándo."""
    vertical = height > width
    plan = OverlayPlan(width, height, total)
    anton = fonts / "Anton-Regular.ttf"
    if not anton.exists():
        anton = fonts / "Montserrat.ttf"
    cx = width / 2
    cy = height * (0.30 if vertical else 0.28)
    max_w = int(width * (0.86 if vertical else 0.62))
    big = int(height * (0.062 if vertical else 0.105))
    emoji_size = int(min(width, height) * (0.26 if vertical else 0.2))

    for i, (scene, start, seconds) in enumerate(zip(scenes, starts, durations)):
        if i > 0:
            plan.flashes.append(start)
        text = (hook if i == 0 and hook else scene.get("emphasis") or "").strip()
        emoji = (scene.get("emoji") or "").strip()
        accent = pal.accents[i % len(pal.accents)]
        appear = start + (0.05 if i == 0 else 0.18)
        hold = seconds - 0.35 if i == 0 else min(seconds - 0.3, 2.6)
        end = appear + max(hold, 0.8)
        tilt = (-3.0 if i % 2 == 0 else 2.5) if vertical else (-2.0 if i % 2 == 0 else 1.5)
        sprite_w = sprite_h = 0
        if text:
            img = callout_sprite(text.upper(), anton, big if i else int(big * 1.1), max_w, accent + (255,), pal.ink + (255,))
            plan.sprites.append(Sprite(img, appear, end, cx, cy, tilt=tilt))
            sprite_w, sprite_h = img.size
        if emoji:
            img = emoji_image(emoji, emoji_size, emoji_cache)
            if img is not None:
                if not text:
                    ex, ey = cx, cy
                elif vertical:  # encima del rótulo
                    ex, ey = cx, cy - sprite_h / 2 - emoji_size * 0.3
                else:  # a la derecha del rótulo, sin salirse de la pantalla
                    ex = min(cx + sprite_w / 2 + emoji_size * 0.2, width - emoji_size * 0.65)
                    ey = cy - sprite_h * 0.25
                plan.sprites.append(Sprite(img, appear + (0.12 if text else 0), end, ex, ey, tilt=-tilt * 2, wobble=7.0, pop=0.45))
    return plan


def render_overlay_frame(plan: OverlayPlan, t: float) -> bytes | None:
    """Fotograma RGBA de la capa de gráficos en el instante t, o None si está vacía."""
    active = [s for s in plan.sprites if s.start <= t < s.end]
    flash = next((t - c for c in plan.flashes if 0 <= t - c < 0.14), None)
    if not active and flash is None:
        return None
    canvas = Image.new("RGBA", (plan.width, plan.height), (0, 0, 0, 0))
    if flash is not None:
        alpha = int(110 * (1 - flash / 0.14))
        canvas.paste((255, 255, 255, alpha), (0, 0, plan.width, plan.height))
    for s in active:
        p_in = (t - s.start) / s.pop
        p_out = (s.end - t) / 0.22
        scale = 0.25 + 0.75 * ease_out_back(p_in) if p_in < 1 else 1.0
        alpha = clamp(p_in * 3) * clamp(p_out)
        if p_out < 1:
            scale *= 0.85 + 0.15 * p_out
        angle = s.tilt + (s.wobble * math.sin((t - s.start) * 5.2) if s.wobble else 0.0)
        if p_in < 1:
            angle += (1 - ease_out_cubic(p_in)) * (-12 if s.tilt < 0 else 12)
        w = max(int(s.image.width * scale), 2)
        h = max(int(s.image.height * scale), 2)
        img = s.image.resize((w, h), Image.BILINEAR)
        if abs(angle) > 0.2:
            img = img.rotate(angle, resample=Image.BILINEAR, expand=True)
        if alpha < 0.999:
            a = img.getchannel("A").point(lambda v, k=alpha: int(v * k))
            img.putalpha(a)
        canvas.alpha_composite(img, (int(s.cx - img.width / 2), int(s.cy - img.height / 2)))
    return canvas.tobytes()


def overlay_writer(plan: OverlayPlan, stdin, frames: int) -> None:
    """Escribe la capa de gráficos fotograma a fotograma en la tubería de ffmpeg."""
    empty = bytes(plan.width * plan.height * 4)
    for f in range(frames):
        data = render_overlay_frame(plan, f / FPS)
        stdin.write(data if data is not None else empty)
    stdin.close()


# ---------------------------------------------------------------------------
# Audio: música generada y efectos de sonido
# ---------------------------------------------------------------------------

MOODS = {
    # pulsaciones por minuto, acordes (semitonos sobre La 220 Hz), batería
    "energetic": (116, [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], True),
    "chill": (84, [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 5], [-2, 2, 5, 9]], True),
    "epic": (96, [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]], False),
}


def note(semi: float) -> float:
    return 220.0 * 2 ** (semi / 12)


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    """Filtro paso bajo de un polo (suficiente para suavizar la música)."""
    from scipy.signal import lfilter  # noqa: PLC0415  (scipy viene con faster-whisper/kokoro)

    a = math.exp(-2 * math.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def _lowpass_safe(x: np.ndarray, cutoff: float) -> np.ndarray:
    try:
        return lowpass(x, cutoff)
    except Exception:
        k = max(int(SR / cutoff / 2), 1)
        return np.convolve(x, np.ones(k) / k, mode="same")


def music(seconds: float, mood: str, seed: int) -> np.ndarray:
    """Base musical sencilla y suave: pad de acordes, bajo y batería ligera."""
    bpm, chords, drums = MOODS.get(mood, MOODS["energetic"])
    rnd = np.random.default_rng(seed)
    n = int(seconds * SR) + SR
    out = np.zeros(n, dtype=np.float64)
    beat = 60.0 / bpm
    bar = beat * 4
    key = int(rnd.integers(-3, 3))
    t_bar = np.arange(int(bar * SR)) / SR

    # Pad: senos con armónicos y ligera desafinación, entrada y salida suaves por compás
    env = np.minimum(1, t_bar / 0.6) * np.minimum(1, (bar - t_bar) / 0.4)
    bars = int(math.ceil(n / (bar * SR)))
    for b in range(bars):
        chord = chords[b % len(chords)]
        seg = np.zeros_like(t_bar)
        for s in chord:
            f = note(s + key)
            for det in (-0.6, 0.6):
                seg += np.sin(2 * math.pi * (f + det) * t_bar) + 0.3 * np.sin(4 * math.pi * (f + det) * t_bar)
        seg *= env / (len(chord) * 4)
        # Bajo en los tiempos 1 y 3
        root = note(chord[0] + key - 24)
        for k in (0, 2):
            t0 = int(k * beat * SR)
            tb = np.arange(int(beat * 1.6 * SR)) / SR
            bass = np.sin(2 * math.pi * root * tb) * np.exp(-tb * 3.0) * 0.55
            end = min(t0 + len(tb), len(seg))
            seg[t0:end] += bass[: end - t0]
        start = int(b * bar * SR)
        end = min(start + len(seg), n)
        out[start:end] += seg[: end - start]
    out = _lowpass_safe(out, 1800)

    if drums:
        tk = np.arange(int(0.32 * SR)) / SR
        kick = np.sin(2 * math.pi * (45 + 80 * np.exp(-tk * 30)) * tk) * np.exp(-tk * 9) * 0.9
        th = np.arange(int(0.05 * SR)) / SR
        hat_noise = rnd.standard_normal(len(th))
        hat = (hat_noise - _lowpass_safe(hat_noise, 6000)) * np.exp(-th * 90) * 0.12
        ts = np.arange(int(0.18 * SR)) / SR
        snare_noise = rnd.standard_normal(len(ts))
        snare = _lowpass_safe(snare_noise, 3500) * np.exp(-ts * 22) * 0.35
        steps = int(seconds / (beat / 2)) + 2
        for k in range(steps):
            t0 = int(k * beat / 2 * SR)
            pos = k % 8
            for sample, hit in ((kick, pos in (0, 4) or (mood == "energetic" and pos == 5)), (snare, pos in (2, 6)), (hat, True)):
                if hit and t0 < n:
                    end = min(t0 + len(sample), n)
                    out[t0:end] += sample[: end - t0]

    out = out[: int(seconds * SR)]
    fade_in = min(int(1.0 * SR), len(out))
    fade_out = min(int(2.5 * SR), len(out))
    out[:fade_in] *= np.linspace(0, 1, fade_in)
    out[len(out) - fade_out :] *= np.linspace(1, 0, fade_out)
    peak = np.max(np.abs(out)) or 1.0
    return out / peak * 0.5


def whoosh(rnd: np.random.Generator) -> np.ndarray:
    length = int(0.45 * SR)
    t = np.arange(length) / SR
    noise = rnd.standard_normal(length)
    # Barrido: mezcla de ruido grave y agudo que cambia con el tiempo
    lo = _lowpass_safe(noise, 700)
    hi = noise - _lowpass_safe(noise, 2500)
    sweep = np.clip(t / 0.3, 0, 1)
    sig = lo * (1 - sweep) + hi * sweep * 0.6
    env = np.sin(np.pi * np.clip(t / 0.45, 0, 1)) ** 2
    return sig * env * 0.35


def pop() -> np.ndarray:
    t = np.arange(int(0.11 * SR)) / SR
    freq = 520 + 380 * np.exp(-t * 40)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * np.exp(-t * 38) * 0.45


def sfx_track(seconds: float, cuts: list[float], pops: list[float], seed: int) -> np.ndarray:
    rnd = np.random.default_rng(seed)
    n = int(seconds * SR)
    out = np.zeros(n)
    for c in cuts:
        w = whoosh(rnd)
        t0 = int((c - 0.28) * SR)
        if 0 <= t0 < n:
            end = min(t0 + len(w), n)
            out[t0:end] += w[: end - t0]
    p = pop()
    for c in pops:
        t0 = int(c * SR)
        if 0 <= t0 < n:
            end = min(t0 + len(p), n)
            out[t0:end] += p[: end - t0]
    return out


def write_wav(samples: np.ndarray, out: Path) -> None:
    data = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
