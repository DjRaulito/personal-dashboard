"""Efectos del estudio de vídeo: fondos animados generados, titulares limpios (estilo editorial),
música generada y efectos de sonido. Todo se crea aquí, sin licencias de terceros."""

from __future__ import annotations

import math
import subprocess
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
# Rótulos
# ---------------------------------------------------------------------------


def load_font(path: Path, size: int, weight: str = "ExtraBold") -> ImageFont.FreeTypeFont:
    """Fuente a `size` px; si es variable (Montserrat), con el grosor pedido."""
    font = ImageFont.truetype(str(path), size)
    try:
        font.set_variation_by_name(weight)
    except Exception:
        pass  # fuente estática o sin ese grosor
    return font


def fit_font(path: Path, text: str, size: int, max_width: int) -> ImageFont.FreeTypeFont:
    while size > 24:
        font = load_font(path, size)
        if font.getbbox(text)[2] <= max_width:
            return font
        size = int(size * 0.92)
    return load_font(path, size)


def wrap_lines(text: str, font_path: Path, size: int, max_width: int, max_lines: int = 3) -> tuple[list[str], ImageFont.FreeTypeFont]:
    """Parte el texto en líneas que quepan; si no cabe en `max_lines`, reduce la letra."""
    words = text.split()
    while True:
        font = load_font(font_path, size)
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


def callout_sprite(text: str, font_path: Path, size: int, max_width: int, accent, align: str = "center") -> Image.Image:
    """Titular editorial: texto blanco grueso con una barra fina de color encima, sombra suave y un
    halo oscuro difuso detrás para que se lea sobre cualquier plano."""
    lines, font = wrap_lines(text, font_path, size, max_width)
    ascent, descent = font.getmetrics()
    line_h = int((ascent + descent) * 1.02)
    widths = [font.getbbox(l)[2] for l in lines]
    text_w = max(widths)
    bar_h = max(4, int(font.size * 0.075))
    bar_w = max(int(font.size * 1.6), 40)
    gap = int(font.size * 0.32)
    block_w, block_h = text_w, bar_h + gap + line_h * len(lines)
    margin = int(font.size * 1.6)  # sitio para que el halo se difumine sin cortarse
    img = Image.new("RGBA", (block_w + 2 * margin, block_h + 2 * margin), (0, 0, 0, 0))

    # Halo oscuro muy difuso
    halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(halo).rounded_rectangle(
        (margin - font.size * 0.5, margin - font.size * 0.3, img.width - margin + font.size * 0.5, img.height - margin + font.size * 0.3),
        radius=int(font.size * 0.5),
        fill=(0, 0, 0, 110),
    )
    img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(int(font.size * 0.4))))

    def x_for(w: int) -> int:
        return margin + (0 if align == "left" else (block_w - w) // 2)

    # Sombra del texto
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    off = max(2, int(font.size * 0.04))
    y = margin + bar_h + gap
    for line, w in zip(lines, widths):
        sd.text((x_for(w) + off, y + off), line, font=font, fill=(0, 0, 0, 170))
        y += line_h
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(max(2, int(font.size * 0.06)))))

    draw = ImageDraw.Draw(img)
    bx = x_for(bar_w)
    draw.rounded_rectangle((bx, margin, bx + bar_w, margin + bar_h), radius=bar_h // 2, fill=tuple(accent[:3]) + (255,))
    y = margin + bar_h + gap
    for line, w in zip(lines, widths):
        draw.text((x_for(w), y), line, font=font, fill=(248, 246, 242, 255))
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
    pop: float = 0.5  # duración de la entrada (fundido + subida)


@dataclass
class OverlayPlan:
    width: int
    height: int
    total: float
    sprites: list[Sprite] = field(default_factory=list)


def plan_overlay(scenes: list[dict], starts: list[float], durations: list[float], width: int, height: int,
                 total: float, pal: Palette, fonts: Path, hook: str | None) -> OverlayPlan:
    """Decide qué titular sale en cada escena, dónde y cuándo."""
    vertical = height > width
    plan = OverlayPlan(width, height, total)
    font = fonts / "Montserrat.ttf"
    if not font.exists():
        font = fonts / "Anton-Regular.ttf"
    max_w = int(width * (0.84 if vertical else 0.56))
    size = int(height * (0.046 if vertical else 0.072))

    for i, (scene, start, seconds) in enumerate(zip(scenes, starts, durations)):
        text = (hook if i == 0 and hook else scene.get("emphasis") or "").strip()
        if not text:
            continue
        accent = pal.accents[i % len(pal.accents)]
        appear = start + (0.1 if i == 0 else 0.25)
        hold = seconds - 0.4 if i == 0 else min(seconds - 0.4, 2.8)
        end = appear + max(hold, 1.0)
        if vertical:
            img = callout_sprite(text.upper(), font, int(size * (1.25 if i == 0 else 1)), max_w, accent)
            cx, cy = width / 2, height * (0.40 if i == 0 else 0.22)
        else:  # titular a la izquierda, en el tercio superior
            img = callout_sprite(text.upper(), font, int(size * (1.2 if i == 0 else 1)), max_w, accent, align="left")
            cx, cy = width * 0.06 + img.width / 2, height * (0.36 if i == 0 else 0.24)
        plan.sprites.append(Sprite(img, appear, end, cx, cy))
    return plan


def render_overlay_frame(plan: OverlayPlan, t: float) -> bytes | None:
    """Fotograma RGBA de la capa de gráficos en el instante t, o None si está vacía."""
    active = [s for s in plan.sprites if s.start <= t < s.end]
    if not active:
        return None
    canvas = Image.new("RGBA", (plan.width, plan.height), (0, 0, 0, 0))
    rise = plan.height * 0.025
    for s in active:
        p_in = ease_out_cubic(clamp((t - s.start) / s.pop))
        p_out = clamp((s.end - t) / 0.3)
        alpha = p_in * p_out
        img = s.image
        if alpha < 0.999:
            img = img.copy()
            img.putalpha(img.getchannel("A").point(lambda v, k=alpha: int(v * k)))
        y = s.cy + (1 - p_in) * rise
        canvas.alpha_composite(img, (int(s.cx - img.width / 2), int(y - img.height / 2)))
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
