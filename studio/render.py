"""Montaje con ffmpeg: prepara los clips de cada escena, une audio y vídeo y quema los subtítulos."""

from __future__ import annotations

import json
import random
import subprocess
from pathlib import Path

FPS = 30
# Fondos de respaldo (sin clips de stock): colores apagados de DESIGN.md
FALLBACK_COLORS = ["0x16161B", "0x1E1E24", "0x2A3150", "0x2C3A2E", "0x3A2C28", "0x23353A"]


def run(args: list[str]) -> None:
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        # Solo la cola del error: el registro es público
        raise RuntimeError(f"ffmpeg falló: {proc.stderr[-600:]}")


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


def normalize_audio(src: Path, out: Path, pad: float = 0.0) -> None:
    """WAV mono 44,1 kHz con un silencio final opcional (respiro entre escenas)."""
    af = f"apad=pad_dur={pad}" if pad > 0 else "anull"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", af, "-ac", "1", "-ar", "44100", str(out)])


def concat_audio(parts: list[Path], out: Path) -> None:
    listing = out.with_suffix(".txt")
    listing.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)])


def clip_segment(src: Path, out: Path, width: int, height: int, seconds: float, zoom_in: bool) -> None:
    """Recorta el clip al formato (rellena la pantalla), lo repite si es corto y añade un zoom suave."""
    frames = max(int(seconds * FPS), 1)
    # z va de 1 a 1,08 (o al revés) a lo largo del segmento; se escala por fotograma y se recorta al centro
    z = f"(1+0.08*n/{frames})" if zoom_in else f"(1.08-0.08*n/{frames})"
    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps={FPS},"
        f"scale=w='trunc({width}*{z}/2)*2':h='trunc({height}*{z}/2)*2':eval=frame,"
        f"crop={width}:{height},setsar=1,format=yuv420p"
    )
    run(
        [
            "ffmpeg", "-y", "-v", "error", "-stream_loop", "-1", "-i", str(src), "-t", f"{seconds:.3f}",
            "-vf", vf, "-an", "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", str(out),
        ]
    )


def fallback_segment(out: Path, width: int, height: int, seconds: float, seed: int) -> None:
    """Fondo en degradado lento cuando no hay clip (sin clave de Pexels o descarga fallida)."""
    rnd = random.Random(seed)
    c0, c1 = rnd.sample(FALLBACK_COLORS, 2)
    run(
        [
            "ffmpeg", "-y", "-v", "error", "-f", "lavfi",
            "-i", f"gradients=s={width}x{height}:c0={c0}:c1={c1}:speed=0.008:r={FPS}:d={seconds:.3f}",
            "-vf", "format=yuv420p,setsar=1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", str(out),
        ]
    )


def concat_video(parts: list[Path], out: Path) -> None:
    listing = out.with_suffix(".txt")
    listing.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)])


def final_mix(video: Path, narration: Path, subtitles: Path, fonts: Path, out: Path, long_form: bool) -> None:
    """Vídeo + voz + subtítulos. Bitrate acotado para que los archivos no se disparen."""
    maxrate = "4M" if long_form else "6M"
    run(
        [
            "ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(narration),
            "-vf", f"ass={subtitles}:fontsdir={fonts}",
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-maxrate", maxrate, "-bufsize", "8M",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
            "-shortest", "-movflags", "+faststart", str(out),
        ]
    )


def thumbnail(video: Path, out: Path) -> None:
    run(["ffmpeg", "-y", "-v", "error", "-ss", "1", "-i", str(video), "-frames:v", "1", "-q:v", "3", str(out)])
