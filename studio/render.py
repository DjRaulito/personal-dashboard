"""Montaje con ffmpeg: prepara los clips de cada escena, une audio y vídeo y quema los subtítulos."""

from __future__ import annotations

import json
import math
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


def filter_path(path: Path) -> str:
    """Ruta para un filtro de ffmpeg (ass): barras normales, la «:» de la unidad de Windows escapada y
    entre comillas. En Linux solo cambian las comillas."""
    return "'" + Path(path).resolve().as_posix().replace(":", "\\:") + "'"


def list_line(path: Path) -> str:
    """Línea de una lista de concat de ffmpeg (barras normales también en Windows)."""
    return f"file '{path.resolve().as_posix()}'\n"


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
    listing.write_text("".join(list_line(p) for p in parts))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)])


def clip_segment(
    src: Path, out: Path, width: int, height: int, seconds: float, zoom_in: bool, still: bool = False,
    punch: bool = False, zoom: bool = True,
) -> None:
    """Recorta el clip (o la imagen) al formato, lo repite si es corto, le da un zoom lento, un golpe
    de zoom al entrar si toca y un etalonaje suave con viñeta. Con `zoom=False` (Remotion pone el zoom)
    solo recorta y da color. Si el zoom fotograma a fotograma falla (ffmpeg 9 en Windows se cae con
    algunos clips), se repite sin zoom antes de rendirse."""
    source = ["-loop", "1", "-framerate", str(FPS), "-i", str(src)] if still else ["-stream_loop", "-1", "-i", str(src)]
    grade = "eq=contrast=1.05:saturation=1.04,vignette=PI/6,unsharp=5:5:0.4,setsar=1,format=yuv420p"

    def encode(vf: str) -> None:
        run(
            [
                "ffmpeg", "-y", "-v", "error", *source, "-t", f"{seconds:.3f}",
                "-vf", vf, "-an", "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", str(out),
            ]
        )

    static = (
        f"scale={width}:{height}:force_original_aspect_ratio=increase:flags=lanczos,crop={width}:{height},fps={FPS},{grade}"
    )
    if not zoom:
        encode(static)
        return
    try:
        encode(zoom_filter(width, height, seconds, zoom_in, still, punch) + "," + grade)
    except RuntimeError:
        encode(static)


def zoom_filter(width: int, height: int, seconds: float, zoom_in: bool, still: bool, punch: bool) -> str:
    frames = max(int(seconds * FPS), 1)
    # Zoom lento y sutil (más en imágenes fijas); el golpe de entrada es apenas un 4 %
    amount = 0.08 if still else 0.05
    z = f"(1+{amount}*n/{frames})" if zoom_in else f"({1 + amount}-{amount}*n/{frames})"
    zmax = 1 + amount
    if punch:  # entra un 4 % más cerca y se asienta en 10 fotogramas
        z = f"({z}+0.04*max(0,1-n/10))"
        zmax += 0.04
    # Se escala una sola vez con lanczos al tamaño del zoom máximo y luego cada fotograma se REDUCE
    # (nunca se vuelve a ampliar): así el zoom no ablanda la imagen
    big_w, big_h = int(width * zmax / 2 + 1) * 2, int(height * zmax / 2 + 1) * 2
    return (
        f"scale={big_w}:{big_h}:force_original_aspect_ratio=increase:flags=lanczos,crop={big_w}:{big_h},fps={FPS},"
        f"scale=w='trunc({width}*{z}/2)*2':h='trunc({height}*{z}/2)*2':eval=frame:flags=bicubic,"
        f"crop={width}:{height}"
    )


def concat_video(parts: list[Path], out: Path) -> None:
    listing = out.with_suffix(".txt")
    listing.write_text("".join(list_line(p) for p in parts))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)])


def final_mix(
    video: Path,
    narration: Path,
    subtitles: Path,
    fonts: Path,
    out: Path,
    long_form: bool,
    overlay=None,
    music: Path | None = None,
    sfx: Path | None = None,
    bar_color: str = "0xF6BE48",
) -> None:
    """Vídeo + capa de gráficos (por tubería) + barra de progreso + subtítulos; voz con la música
    agachada por debajo y los efectos. Bitrate acotado para que los archivos no se disparen."""
    import threading

    import fx

    width, height = probe_size(video)
    total = duration(narration)
    frames = int(math.ceil(total * FPS)) + 2
    maxrate = "10M" if long_form else "12M"
    bar_h = max(4, height // 360)

    inputs = ["-i", str(video)]
    graph = []
    v = "[0:v]"
    if overlay is not None:
        inputs += ["-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{width}x{height}", "-r", str(FPS), "-i", "-"]
        graph.append(f"{v}[1:v]overlay=format=auto:eof_action=pass[ov]")
        v = "[ov]"
    graph.append(f"color=c={bar_color}@0.8:s={width}x{bar_h}:r={FPS}[bar]")
    graph.append(f"{v}[bar]overlay=x='-W+W*t/{total:.3f}':y=H-h:eval=frame:shortest=1[pb]")
    graph.append(f"[pb]ass=filename={filter_path(subtitles)}:fontsdir={filter_path(fonts)}[v]")

    audio_index = 2 if overlay is not None else 1
    inputs += ["-i", str(narration)]
    voice = f"[{audio_index}:a]"
    mix = []
    if music is not None:
        inputs += ["-i", str(music)]
        graph.append(f"{voice}asplit=2[vo][sc]")
        graph.append(f"[{audio_index + 1}:a]volume=0.32[mu]")
        graph.append("[mu][sc]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=350[duck]")
        mix += ["[vo]", "[duck]"]
    else:
        mix.append(voice)
    if sfx is not None:
        inputs += ["-i", str(sfx)]
        graph.append(f"[{audio_index + (2 if music is not None else 1)}:a]volume=0.3[fx]")
        mix.append("[fx]")
    if len(mix) > 1:
        graph.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first[am]")
    else:
        graph.append(f"{mix[0]}anull[am]")
    graph.append("[am]loudnorm=I=-14:TP=-1.5:LRA=11[a]")

    args = [
        "ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(graph),
        "-map", "[v]", "-map", "[a]", "-t", f"{total:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-maxrate", maxrate, "-bufsize", "20M",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
        "-movflags", "+faststart", str(out),
    ]
    if overlay is None:
        run(args)
        return
    proc = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    errors: list[bytes] = []
    reader = threading.Thread(target=lambda: errors.append(proc.stderr.read()), daemon=True)
    reader.start()
    try:
        fx.overlay_writer(overlay, proc.stdin, frames)
    except BrokenPipeError:
        pass
    code = proc.wait()
    reader.join(timeout=5)
    if code != 0:
        raise RuntimeError(f"ffmpeg falló: {(errors[0] if errors else b'').decode(errors='ignore')[-600:]}")


def audio_graph(first: int, music: bool, sfx: bool) -> tuple[list[str], str]:
    """Filtros de audio: voz (entrada `first`), música agachada bajo la voz y efectos, normalizado."""
    graph: list[str] = []
    voice = f"[{first}:a]"
    mix: list[str] = []
    if music:
        graph.append(f"{voice}asplit=2[vo][sc]")
        graph.append(f"[{first + 1}:a]volume=0.32[mu]")
        graph.append("[mu][sc]sidechaincompress=threshold=0.02:ratio=9:attack=15:release=350[duck]")
        mix += ["[vo]", "[duck]"]
    else:
        mix.append(voice)
    if sfx:
        graph.append(f"[{first + (2 if music else 1)}:a]volume=0.3[fx]")
        mix.append("[fx]")
    if len(mix) > 1:
        graph.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first[am]")
    else:
        graph.append(f"{mix[0]}anull[am]")
    graph.append("[am]loudnorm=I=-14:TP=-1.5:LRA=11[a]")
    return graph, "[a]"


def mux_audio(video: Path, narration: Path, out: Path, music: Path | None = None, sfx: Path | None = None) -> None:
    """Pone la voz, la música y los efectos a un vídeo ya terminado (Remotion) sin recomprimir la imagen."""
    inputs = ["-i", str(video), "-i", str(narration)]
    if music is not None:
        inputs += ["-i", str(music)]
    if sfx is not None:
        inputs += ["-i", str(sfx)]
    graph, label = audio_graph(1, music is not None, sfx is not None)
    run(
        [
            "ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(graph),
            "-map", "0:v", "-map", label, "-t", f"{duration(narration):.3f}",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", str(out),
        ]
    )


def probe_size(path: Path) -> tuple[int, int]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    stream = json.loads(out)["streams"][0]
    return int(stream["width"]), int(stream["height"])


def thumbnail(video: Path, out: Path, title: str = "", fonts: Path | None = None, accent=(246, 190, 72)) -> None:
    """Miniatura: un fotograma limpio (sin rótulos ni subtítulos) con el gancho en grande encima."""
    frame = out.with_suffix(".frame.jpg")
    run(["ffmpeg", "-y", "-v", "error", "-ss", "1", "-i", str(video), "-frames:v", "1", "-q:v", "2", str(frame)])
    if not title or fonts is None:
        frame.replace(out)
        return
    try:
        from PIL import Image, ImageEnhance

        import fx

        img = Image.open(frame).convert("RGB")
        img = ImageEnhance.Brightness(img).enhance(0.75).convert("RGBA")
        font = fonts / "Montserrat.ttf"
        if not font.exists():
            font = fonts / "Anton-Regular.ttf"
        vertical = img.height > img.width
        sprite = fx.callout_sprite(
            title.upper(), font, int(img.height * (0.06 if vertical else 0.1)), int(img.width * 0.86), accent
        )
        img.alpha_composite(sprite, ((img.width - sprite.width) // 2, (img.height - sprite.height) // 2))
        img.convert("RGB").save(out, quality=90)
        frame.unlink(missing_ok=True)
    except Exception as e:
        print(f"aviso: miniatura sencilla ({type(e).__name__})")
        frame.replace(out)
