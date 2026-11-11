"""Capa visual con Remotion (estudio local, fase 2): transiciones entre escenas, gancho animado,
titulares por escena y subtítulos por golpes de palabras. Remotion renderiza la imagen (sin sonido)
a partir de los planos ya recortados por ffmpeg; el audio se mezcla después con ffmpeg.

Se activa con STUDIO_RENDERER=remotion (el estudio local lo pone por defecto) si `studio/remotion`
tiene sus dependencias instaladas (`npm ci` dentro). Si algo falla, el worker vuelve al montaje clásico.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
from pathlib import Path

DIR = Path(__file__).resolve().parent / "remotion"
CLI = DIR / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
TRANSITION = 0.4  # solape entre escenas (s): el plano saliente dura esto de más


def available() -> bool:
    return os.environ.get("STUDIO_RENDERER", "ffmpeg") == "remotion" and CLI.exists() and bool(shutil.which("node"))


def hex_color(rgb: tuple[int, int, int]) -> str:
    return "#%02X%02X%02X" % tuple(rgb[:3])


def build_props(
    script: dict,
    starts: list[float],
    durations: list[float],
    pieces: list[list[dict]],
    words: list,
    width: int,
    height: int,
    total: float,
    accent: tuple[int, int, int],
) -> dict:
    scenes = script["scenes"]
    return {
        "width": width,
        "height": height,
        "fps": 30,
        "seconds": round(total, 3),
        "accent": hex_color(accent),
        "hook": (script.get("hook") or "").strip(),
        "transition": TRANSITION,
        "scenes": [
            {
                "start": round(starts[i], 3),
                "seconds": round(durations[i], 3),
                "pieces": pieces[i],
                "headline": (scene.get("emphasis") or "").strip(),
            }
            for i, scene in enumerate(scenes)
        ],
        "words": [{"text": w.text, "start": round(w.start, 3), "end": round(w.end, 3)} for w in words],
    }


def free_port() -> int:
    """Puerto libre en 127.0.0.1 para el servidor interno de Remotion. Se fija (con --ipv4) porque en
    Windows «localhost» resuelve a ::1 y el proxy de vídeo no encuentra los planos."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def render(props: dict, out: Path, public_dir: Path, progress=None) -> None:
    """Renderiza la composición «Video» a `out` (H.264, sin audio). Los planos se leen de `public_dir`."""
    port = free_port()
    props = {**props, "mediaBase": f"http://127.0.0.1:{port}/public/"}
    props_file = public_dir / "props.json"
    props_file.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
    cmd = [
        shutil.which("node") or "node", str(CLI), "render", "src/index.ts", "Video", str(out),
        f"--props={props_file}", f"--public-dir={public_dir}", "--muted", "--codec=h264",
        # Bitrate fijo (como el montaje clásico): con CRF Remotion no respeta el tope y los archivos se disparan
        f"--video-bitrate={os.environ.get('STUDIO_REMOTION_BITRATE', '10M')}",
        f"--concurrency={os.environ.get('STUDIO_REMOTION_CONCURRENCY', '50%')}", f"--port={port}", "--ipv4",
    ]
    # Sin colores para poder leer el progreso y los errores
    env = {**os.environ, "FORCE_COLOR": "0", "NO_COLOR": "1"}
    proc = subprocess.Popen(
        cmd, cwd=DIR, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        encoding="utf-8", errors="replace",
    )
    tail: list[str] = []
    last = -1
    assert proc.stdout is not None
    for line in proc.stdout:
        tail = (tail + [line.rstrip()])[-25:]
        match = re.search(r"Rendered (\d+)/(\d+)", line)
        if match and progress:
            pct = 86 + int(7 * int(match.group(1)) / max(1, int(match.group(2))))
            if pct != last:
                last = pct
                progress(pct, "Animando con Remotion")
    if proc.wait() != 0 or not out.exists():
        raise RuntimeError("Remotion falló: " + " | ".join(t for t in tail if t.strip())[-700:])
