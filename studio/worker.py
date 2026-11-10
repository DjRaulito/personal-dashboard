"""Worker del VoiceStudio (corre en GitHub Actions).

Uso: python worker.py claim <job_id>   → guarda job.json y escribe voice_mode en GITHUB_OUTPUT
     python worker.py render <job_id>  → genera el vídeo, lo sube a Drive y marca el trabajo como listo
     python worker.py demo             → vídeo de prueba con demo_job.json, sin red de la app

Habla con la base de datos solo mediante la función `studio_worker` y la clave STUDIO_WORKER_TOKEN.
El repo es público: no se imprime el guion ni ningún enlace en el registro.
"""

from __future__ import annotations

import json
import os
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import captions
import fx
import render

WORK = Path(os.environ.get("STUDIO_WORKDIR", "/tmp/studio"))
FONTS = Path(os.environ.get("STUDIO_FONTS", WORK / "fonts"))
SCENE_GAP = 0.25  # respiro entre escenas (s)
IMAGE_API = os.environ.get("STUDIO_IMAGE_API", "https://image.pollinations.ai/prompt")
IMAGE_API_KEYED = os.environ.get("STUDIO_IMAGE_API_KEYED", "https://gen.pollinations.ai/image")


# ---------------------------------------------------------------------------
# API de la app (Supabase RPC)
# ---------------------------------------------------------------------------


def rpc(job_id: str, action: str, args: dict | None = None) -> dict:
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/rpc/studio_worker"
    key = os.environ["SUPABASE_PUBLISHABLE_KEY"]
    body = json.dumps(
        {"p_token": os.environ["STUDIO_WORKER_TOKEN"], "p_job": job_id, "p_action": action, "p_args": args or {}}
    ).encode()
    req = urllib.request.Request(
        url, data=body, method="POST", headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                data = json.loads(res.read() or b"{}")
            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(data["error"])
            return data
        except urllib.error.URLError:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    return {}


class Progress:
    def __init__(self, job_id: str | None) -> None:
        self.job_id = job_id

    def __call__(self, pct: int, stage: str) -> None:
        print(f"[{pct:3d}%] {stage}", flush=True)
        if self.job_id:
            try:
                rpc(self.job_id, "progress", {"progress": pct, "stage": stage})
            except Exception as e:  # el progreso nunca tumba el montaje
                print(f"aviso: no se pudo enviar el progreso ({type(e).__name__})")


def download(url: str, out: Path) -> Path:
    req = urllib.request.Request(url, headers={"User-Agent": "personal-dashboard-studio"})
    with urllib.request.urlopen(req, timeout=120) as res, open(out, "wb") as f:
        while chunk := res.read(1 << 20):
            f.write(chunk)
    return out


def upload_to_drive(session_url: str, path: Path, mime: str) -> str:
    """Sube el archivo a la sesión de subida reanudable que creó la app. Devuelve el id en Drive."""
    size = path.stat().st_size
    with open(path, "rb") as f:
        req = urllib.request.Request(
            session_url, data=f, method="PUT", headers={"Content-Length": str(size), "Content-Type": mime}
        )
        with urllib.request.urlopen(req, timeout=900) as res:
            return json.loads(res.read())["id"]


# ---------------------------------------------------------------------------
# Montaje
# ---------------------------------------------------------------------------


def produce(job: dict, progress: Progress) -> tuple[Path, Path, float]:
    vertical = job["format"] == "short"
    width, height = (1080, 1920) if vertical else (1920, 1080)
    scenes = job["script"]["scenes"]
    WORK.mkdir(parents=True, exist_ok=True)

    # 1. Voz
    sample = None
    if job["voice_mode"] == "clone":
        progress(5, "Preparando tu muestra de voz")
        raw = WORK / "sample.src"
        if job.get("voice_sample"):
            import base64

            raw.write_bytes(base64.b64decode(job["voice_sample"]))
        else:  # demo: muestra local
            download(job["assets"]["voice_sample_url"], raw)
        sample = WORK / "sample.wav"
        render.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-ac", "1", "-ar", "24000", "-t", "60", str(sample)])

    progress(8, "Cargando la voz")
    import tts

    voice = tts.make_voice(job["voice_mode"], job["voice"], sample)
    audio_parts: list[Path] = []
    durations: list[float] = []
    for i, scene in enumerate(scenes):
        progress(10 + int(40 * i / len(scenes)), f"Narrando escena {i + 1} de {len(scenes)}")
        raw = WORK / f"voice_{i}.wav"
        voice.synth(scene["text"], raw)
        norm = WORK / f"voice_{i}_n.wav"
        render.normalize_audio(raw, norm, pad=SCENE_GAP)
        audio_parts.append(norm)
        durations.append(render.duration(norm))
    narration = WORK / "narration.wav"
    render.concat_audio(audio_parts, narration)
    total = render.duration(narration)

    # 2. Subtítulos sincronizados
    progress(52, "Sincronizando subtítulos")
    heard = transcribe(narration)
    script_words = [w for scene in scenes for w in captions.tokenize(scene["text"])]
    words = captions.align(script_words, heard, total)
    seed = zlib.crc32(job["script"].get("title", "").encode())
    pal = fx.palette_for(seed)
    subtitles = WORK / "subs.ass"
    subtitles.write_text(
        captions.build_ass(words, width, height, vertical, accent=fx.bgr_hex(pal.accents[0])), encoding="utf-8"
    )
    starts = [sum(durations[:i]) for i in range(len(durations))]

    # 3. Imágenes generadas por IA para las escenas sin clip de stock
    images = generate_images(scenes, width, height, seed, progress)

    # 4. Planos por escena: clip de stock → imagen IA animada → fondo animado generado
    segments: list[Path] = []
    for i, (scene, seconds) in enumerate(zip(scenes, durations)):
        progress(64 + int(18 * i / len(scenes)), f"Montando escena {i + 1} de {len(scenes)}")
        clips = scene.get("clips") or []
        pieces = max(1, min(len(clips), int(seconds // 2.5) or 1))
        part = seconds / pieces
        for k in range(pieces):
            out = WORK / f"seg_{i}_{k}.mp4"
            punch = k == 0 and i > 0
            try:
                if clips:
                    src = download(clips[k]["url"], WORK / f"clip_{i}_{k}.mp4")
                    render.clip_segment(src, out, width, height, part, zoom_in=(i + k) % 2 == 0, punch=punch)
                elif images.get(i):
                    render.clip_segment(images[i], out, width, height, part, zoom_in=i % 2 == 0, still=True, punch=punch)
                else:
                    raise RuntimeError("sin plano")
            except Exception as e:
                if clips or images.get(i):
                    print(f"escena {i + 1}: fondo animado ({type(e).__name__})")
                fx.procedural_background(out, width, height, part, seed=seed + i * 7 + k, pal=pal)
            segments.append(out)
    visuals = WORK / "visuals.mp4"
    render.concat_video(segments, visuals)

    # 5. Rótulos, emojis, música y efectos
    progress(84, "Animando rótulos y música")
    plan = fx.plan_overlay(
        scenes, starts, durations, width, height, total, pal, FONTS, WORK / "emoji", job["script"].get("hook")
    )
    music = sfx = None
    try:
        music = WORK / "music.wav"
        fx.write_wav(fx.music(total, job["script"].get("mood") or "energetic", seed), music)
        sfx = WORK / "sfx.wav"
        fx.write_wav(fx.sfx_track(total, starts[1:], [s.start for s in plan.sprites if s.pop < 0.4], seed), sfx)
    except Exception as e:
        print(f"aviso: sin música ({type(e).__name__})")
        music = sfx = None

    # 6. Mezcla final
    progress(88, "Renderizando el vídeo final")
    final = WORK / "video.mp4"
    accent = pal.accents[0]
    render.final_mix(
        visuals, narration, subtitles, FONTS, final, long_form=not vertical,
        overlay=plan, music=music, sfx=sfx, bar_color="0x%02X%02X%02X" % accent,
    )
    thumb = WORK / "thumb.jpg"
    title = job["script"].get("hook") or job["script"].get("title", "")
    render.thumbnail(visuals, thumb, title, FONTS, accent)
    return final, thumb, render.duration(final)


def generate_images(scenes: list[dict], width: int, height: int, seed: int, progress: Progress) -> dict[int, Path]:
    """Imágenes IA gratuitas (Pollinations) para las escenas sin clip. Con POLLINATIONS_API_KEY (gratis,
    enter.pollinations.ai) van en paralelo y sin límite; sin clave, una cada ~16 s (límite anónimo) y
    como mucho STUDIO_AI_IMAGES_MAX. Si el servicio no responde, esas escenas usan el fondo animado.
    Se desactiva con STUDIO_AI_IMAGES=0."""
    missing = [i for i, s in enumerate(scenes) if not s.get("clips")]
    if not missing or os.environ.get("STUDIO_AI_IMAGES", "1") == "0":
        return {}
    key = os.environ.get("POLLINATIONS_API_KEY", "").strip()
    if not key:
        missing = missing[: int(os.environ.get("STUDIO_AI_IMAGES_MAX", "14"))]
    progress(58, f"Generando {len(missing)} imágenes con IA")
    w, h = (768, 1344) if height > width else (1344, 768)
    style = "cinematic photo, dramatic lighting, rich colors, shallow depth of field, no text, no watermark"
    failures: list[str] = []

    def one(i: int) -> tuple[int, Path | None]:
        prompt = urllib.parse.quote(f"{scenes[i].get('query', '').strip()}, {style}")
        params = f"width={w}&height={h}&seed={seed + i}&nologo=true&model=flux"
        url = f"{IMAGE_API_KEYED}/{prompt}?{params}" if key else f"{IMAGE_API}/{prompt}?{params}"
        headers = {"User-Agent": "personal-dashboard-studio"}
        if key:
            headers["Authorization"] = f"Bearer {key}"
        out = WORK / f"img_{i}.jpg"
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=120) as res:
                    out.write_bytes(res.read())
                from PIL import Image

                with Image.open(out) as img:
                    if min(img.size) < 256:
                        raise ValueError("imagen pequeña")
                return i, out
            except urllib.error.HTTPError as e:
                failures.append(f"HTTP {e.code}")
                time.sleep(16 if e.code == 429 else 4 * (attempt + 1))
            except Exception as e:  # sin URL en el registro: el repo es público
                failures.append(type(e).__name__)
                time.sleep(4 * (attempt + 1))
        return i, None

    found: dict[int, Path] = {}
    if key:
        with ThreadPoolExecutor(max_workers=4) as pool:
            for i, path in pool.map(one, missing):
                if path:
                    found[i] = path
    else:
        for n, i in enumerate(missing):
            started = time.monotonic()
            _, path = one(i)
            if path:
                found[i] = path
            if n + 1 < len(missing):
                time.sleep(max(0.0, 16 - (time.monotonic() - started)))
    summary = f"imágenes IA: {len(found)} de {len(missing)}"
    if failures:
        summary += f" (fallos: {', '.join(sorted(set(failures)))})"
    print(summary)
    return found


def transcribe(audio: Path) -> list[captions.Word]:
    """Tiempos por palabra con faster-whisper; si falla, los subtítulos se reparten por longitud."""
    try:
        from faster_whisper import WhisperModel

        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(str(audio), language="es", word_timestamps=True, vad_filter=False)
        return [captions.Word(w.word.strip(), w.start, w.end) for s in segments for w in (s.words or [])]
    except Exception as e:
        print(f"aviso: sin Whisper ({type(e).__name__}); subtítulos repartidos por longitud")
        return []


# ---------------------------------------------------------------------------
# Entrada
# ---------------------------------------------------------------------------


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    WORK.mkdir(parents=True, exist_ok=True)

    if command == "claim":
        job = rpc(sys.argv[2], "claim")
        (WORK / "job.json").write_text(json.dumps(job))
        os.chmod(WORK / "job.json", 0o600)
        if out := os.environ.get("GITHUB_OUTPUT"):
            with open(out, "a") as f:
                f.write(f"voice_mode={job['voice_mode']}\n")
        print(f"trabajo reclamado: {job['format']}, voz {job['voice_mode']}, {len(job['script']['scenes'])} escenas")
        return 0

    if command == "demo":
        job = json.loads((Path(__file__).parent / "demo_job.json").read_text())
        if len(sys.argv) > 2:
            job["voice_mode"] = sys.argv[2]
        final, thumb, secs = produce(job, Progress(None))
        print(f"demo lista: {secs:.1f} s, {final.stat().st_size / 1e6:.1f} MB")
        return 0

    if command == "render":
        job_id = sys.argv[2]
        job = json.loads((WORK / "job.json").read_text())
        progress = Progress(job_id)
        try:
            final, thumb, secs = produce(job, progress)
            progress(95, "Subiendo a tu Google Drive")
            video_id = upload_to_drive(job["assets"]["video_upload_url"], final, "video/mp4")
            thumb_id = None
            if job["assets"].get("thumb_upload_url"):
                try:
                    thumb_id = upload_to_drive(job["assets"]["thumb_upload_url"], thumb, "image/jpeg")
                except Exception as e:
                    print(f"aviso: miniatura sin subir ({type(e).__name__})")
            rpc(job_id, "done", {"drive_file_id": video_id, "drive_thumb_id": thumb_id, "duration_s": round(secs, 1)})
            print(f"listo: {secs:.1f} s, {final.stat().st_size / 1e6:.1f} MB")
            return 0
        except Exception as e:
            traceback.print_exc(limit=3)
            message = f"{type(e).__name__}: {str(e)[:400]}"
            try:
                rpc(job_id, "fail", {"error": message})
            except Exception:
                pass
            return 1

    if command == "fail":
        rpc(sys.argv[2], "fail", {"error": sys.argv[3] if len(sys.argv) > 3 else "El montaje falló"})
        return 0

    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
