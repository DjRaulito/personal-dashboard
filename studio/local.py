"""Estudio local: monta los vídeos del VoiceStudio en tu PC con la voz de VoiceStudio (OmniVoice en la GPU).

Uso (lo arranca `studio/local.ps1`):
    python local.py               → se queda esperando trabajos de la app y los monta
    python local.py --once        → monta como mucho un trabajo y sale
    python local.py demo [ai|clone] → vídeo de prueba (demo_job.json) sin tocar la app

Lee la configuración de `.env.local` (raíz del proyecto, nunca va al repo):
    STUDIO_LOCAL_TOKEN                     clave del PC (Ajustes del VoiceStudio → «Tu PC»)
    NEXT_PUBLIC_SUPABASE_URL               ya está para la web
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   ya está para la web
    VOICESTUDIO_URL       opcional, por defecto http://127.0.0.1:3900
    VOICESTUDIO_PROFILE   opcional, id del perfil de tu voz (por defecto, el último que no sea de demo)
    POLLINATIONS_API_KEY  opcional, imágenes IA para escenas sin clip
    STUDIO_KEEP_DIR       opcional, carpeta donde dejar una copia de cada vídeo (por defecto Vídeos\\Estudio)

Mientras VoiceStudio esté abierto, avisa a la app cada 20 s («encendido») y reclama el siguiente vídeo
en cola. Si VoiceStudio está cerrado deja de avisar y la app usa GitHub Actions.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POLL_S = 15
HEARTBEAT_S = 20
FONT_URLS = {
    "Montserrat.ttf": "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
    "Anton-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf",
}


def load_env(path: Path) -> dict[str, str]:
    """Lector mínimo de .env: CLAVE=valor, comentarios con #, comillas opcionales."""
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def setup_env() -> None:
    env = load_env(ROOT / ".env.local")
    for key, value in env.items():
        os.environ.setdefault(key, value)
    os.environ.setdefault("SUPABASE_URL", os.environ.get("NEXT_PUBLIC_SUPABASE_URL", ""))
    os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""))
    # El worker firma con STUDIO_WORKER_TOKEN: en el PC es la clave del PC
    if os.environ.get("STUDIO_LOCAL_TOKEN"):
        os.environ["STUDIO_WORKER_TOKEN"] = os.environ["STUDIO_LOCAL_TOKEN"]
    os.environ.setdefault("STUDIO_VOICE_ENGINE", "voicestudio")
    os.environ.setdefault("STUDIO_WHISPER_MODEL", "small")  # en el PC sobra máquina para algo mejor que «base»
    base = Path(tempfile.gettempdir())
    os.environ.setdefault("STUDIO_WORKDIR", str(base / "studio-local"))
    os.environ.setdefault("STUDIO_FONTS", str(base / "studio-fonts"))
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    find_ffmpeg()


def find_ffmpeg() -> None:
    """winget añade ffmpeg al PATH del usuario, que una consola abierta antes de instalarlo no ve: se
    relee del registro y, si no, se busca en las carpetas de winget."""
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        return
    extra: list[str] = []
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            extra += os.path.expandvars(winreg.QueryValueEx(key, "Path")[0]).split(os.pathsep)
    except (ImportError, OSError):
        pass
    winget = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet"
    extra.append(str(winget / "Links"))
    extra += [str(p.parent) for p in (winget / "Packages").glob("Gyan.FFmpeg*/*/bin/ffmpeg.exe")]
    for folder in extra:
        if folder and (Path(folder) / "ffmpeg.exe").exists() and (Path(folder) / "ffprobe.exe").exists():
            os.environ["PATH"] = f"{folder}{os.pathsep}{os.environ['PATH']}"
            return
    raise SystemExit("Falta ffmpeg. Instálalo con: winget install --id Gyan.FFmpeg -e")


def ensure_fonts() -> None:
    fonts = Path(os.environ["STUDIO_FONTS"])
    fonts.mkdir(parents=True, exist_ok=True)
    for name, url in FONT_URLS.items():
        target = fonts / name
        if not target.exists():
            req = urllib.request.Request(url, headers={"User-Agent": "personal-dashboard-studio"})
            with urllib.request.urlopen(req, timeout=60) as res:
                target.write_bytes(res.read())


def voicestudio_health() -> dict | None:
    base = (os.environ.get("VOICESTUDIO_URL") or "http://127.0.0.1:3900").rstrip("/")
    try:
        with urllib.request.urlopen(base + "/health", timeout=5) as res:
            data = json.loads(res.read())
        return data if data.get("status") == "ok" else None
    except Exception:
        return None


def describe(health: dict) -> str:
    device = str(health.get("device", ""))
    if "(" in device:  # «cuda (NVIDIA GeForce RTX 4070 SUPER)» → la tarjeta
        device = device.split("(", 1)[1].rstrip(")")
    return f"VoiceStudio {health.get('version', '?')} · {device}".strip(" ·")[:200]


class Heartbeat:
    """Avisa a la app cada 20 s mientras VoiceStudio responda (también durante un montaje largo)."""

    def __init__(self, rpc) -> None:
        self.rpc = rpc
        self.info = ""
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self.loop, daemon=True)

    def loop(self) -> None:
        while not self.stop.wait(HEARTBEAT_S):
            health = voicestudio_health()
            if not health:
                continue
            self.info = describe(health)
            try:
                self.rpc(None, "heartbeat", {"info": self.info})
            except Exception as e:
                print(f"aviso: sin conexión con la app ({type(e).__name__})", flush=True)


def keep_copy(video: Path, job: dict) -> None:
    folder = Path(os.environ.get("STUDIO_KEEP_DIR") or Path.home() / "Videos" / "Estudio")
    try:
        folder.mkdir(parents=True, exist_ok=True)
        title = (job.get("script") or {}).get("title") or job["id"]
        safe = "".join(c for c in title if c.isalnum() or c in " -_").strip()[:60] or job["id"]
        target = folder / f"{time.strftime('%Y-%m-%d')} {safe}.mp4"
        shutil.copy2(video, target)
        print(f"copia en {target}", flush=True)
    except Exception as e:
        print(f"aviso: no se pudo guardar la copia ({type(e).__name__})", flush=True)


def clean_workdir() -> None:
    work = Path(os.environ["STUDIO_WORKDIR"])
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)


def serve(once: bool) -> int:
    for key in ("STUDIO_LOCAL_TOKEN", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"):
        if not os.environ.get(key):
            raise SystemExit(f"Falta {key} en .env.local (la clave del PC se crea en Ajustes del VoiceStudio → «Tu PC»).")
    ensure_fonts()
    import worker

    beat = Heartbeat(worker.rpc)
    beat.thread.start()
    print("Estudio local en marcha. Ctrl+C para parar.", flush=True)
    warned = False
    try:
        while True:
            health = voicestudio_health()
            if not health:
                if not warned:
                    print("VoiceStudio no responde: ábrelo. Mientras tanto la app usa GitHub.", flush=True)
                    warned = True
                time.sleep(POLL_S)
                continue
            if warned:
                print(f"{describe(health)} listo.", flush=True)
                warned = False
            try:
                job = worker.rpc(None, "next", {"info": describe(health)})
            except Exception as e:
                print(f"aviso: la app no respondió ({type(e).__name__}: {str(e)[:120]})", flush=True)
                time.sleep(POLL_S)
                continue
            if job.get("none"):
                if once:
                    print("No hay vídeos en cola.")
                    return 0
                time.sleep(POLL_S)
                continue

            clean_workdir()
            scenes = len((job.get("script") or {}).get("scenes") or [])
            print(f"\nmontando: {job['format']}, voz {job['voice_mode']}, {scenes} escenas", flush=True)
            started = time.monotonic()
            video = worker.render_job(job["id"], job)
            if video:
                keep_copy(video, job)
            print(f"{'hecho' if video else 'falló'} en {time.monotonic() - started:.0f} s", flush=True)
            if once:
                return 0 if video else 1
    except KeyboardInterrupt:
        print("\nParado.")
        return 0
    finally:
        beat.stop.set()


def demo(mode: str) -> int:
    health = voicestudio_health()
    if not health:
        raise SystemExit("VoiceStudio no responde en 127.0.0.1:3900: ábrelo primero.")
    ensure_fonts()
    clean_workdir()
    import worker

    job = json.loads((Path(__file__).parent / "demo_job.json").read_text(encoding="utf-8"))
    job["voice_mode"] = mode
    started = time.monotonic()
    final, _thumb, secs = worker.produce(job, worker.Progress(None))
    job["id"] = f"demo-{mode}"
    keep_copy(final, job)
    print(f"demo lista: {secs:.1f} s de vídeo en {time.monotonic() - started:.0f} s ({describe(health)})")
    return 0


def main() -> int:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    setup_env()
    args = sys.argv[1:]
    if args[:1] == ["demo"]:
        return demo(args[1] if len(args) > 1 else "clone")
    return serve(once="--once" in args)


if __name__ == "__main__":
    sys.exit(main())
