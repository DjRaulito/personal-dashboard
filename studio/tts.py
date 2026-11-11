"""Voces del VoiceStudio. Modelos abiertos que corren en la CPU de GitHub Actions:

- «ai»: Kokoro-82M (Apache 2.0), voces en español.
- «clone»: tu voz con acento de España. Kokoro lee el texto en castellano (espeak «es»: «z» y
  «ce/ci» como /θ/) y el conversor de voz de Chatterbox (MIT) le pone tu timbre a partir de una
  muestra de ~10-60 s. La pronunciación y el ritmo son los de Kokoro: el acento no depende de
  cómo clone el modelo. Con STUDIO_CLONE_ENGINE=tts se usa el clonador de texto a voz (Chatterbox
  afinado es-es), que imita mejor tu forma de hablar pero puede sonar latinoamericano.
"""

from __future__ import annotations

from pathlib import Path

KOKORO_VOICES = {"es_male": "em_alex", "es_female": "ef_dora", "es_male_2": "em_santa"}


class KokoroVoice:
    def __init__(self, voice: str) -> None:
        from kokoro import KPipeline  # import tardío: solo se instala si hace falta

        self.pipeline = KPipeline(lang_code="e")
        self.voice = KOKORO_VOICES.get(voice, "em_alex")

    def synth(self, text: str, out: Path) -> None:
        import numpy as np
        import soundfile as sf

        chunks = [audio for _, _, audio in self.pipeline(text, voice=self.voice, speed=1.05) if audio is not None]
        if not chunks:
            raise RuntimeError("Kokoro no devolvió audio")
        sf.write(out, np.concatenate([np.asarray(c) for c in chunks]), 24000)


# Afinado oficial de Resemble para español de España (Single Language Pack). El modelo general
# tira a acento latinoamericano; este mantiene el castellano. Si no se puede cargar, se usa el
# multilingüe V3 (conserva mejor el acento de la muestra que el V2).
SPAIN_REPO = "ResembleAI/Chatterbox-Multilingual-es-es"
BASE_FILES = ["ve.pt", "s3gen.pt", "grapheme_mtl_merged_expanded_v1.json", "conds.pt", "Cangjie5_TC.json"]


def _spain_checkpoint(work: Path) -> tuple[Path, str]:
    """Carpeta con las piezas del modelo base y las del afinado es-es por encima. Devuelve
    (carpeta, nombre del T3)."""
    from chatterbox.mtl_tts import REPO_ID
    from huggingface_hub import snapshot_download

    spain = Path(snapshot_download(repo_id=SPAIN_REPO, repo_type="model"))
    weights = sorted(spain.rglob("*.safetensors"), key=lambda p: ("t3" not in p.name.lower(), p.name))
    if not weights:
        raise RuntimeError("el afinado es-es no trae pesos .safetensors")
    base = Path(snapshot_download(repo_id=REPO_ID, repo_type="model", allow_patterns=BASE_FILES))
    merged = work / "chatterbox-es-es"
    merged.mkdir(parents=True, exist_ok=True)
    for folder in (base, spain):  # lo del afinado sustituye a lo del base
        for f in folder.rglob("*"):
            if f.is_file() and (f.suffix in {".pt", ".json", ".safetensors"}):
                link = merged / f.name
                if link.exists() or link.is_symlink():
                    link.unlink()
                link.symlink_to(f.resolve())
    return merged, weights[0].name


class ConvertedVoice:
    """Kokoro en castellano + conversión al timbre de la muestra (ChatterboxVC)."""

    def __init__(self, sample: Path, voice: str) -> None:
        import torch
        from chatterbox.vc import ChatterboxVC

        torch.set_num_threads(4)
        self.reader = KokoroVoice(voice)
        self.vc = ChatterboxVC.from_pretrained("cpu")
        self.vc.set_target_voice(str(sample))
        self.work = sample.parent
        print("voz clonada: castellano (Kokoro) convertido a tu timbre", flush=True)

    def synth(self, text: str, out: Path) -> None:
        import torchaudio

        source = self.work / f"{out.stem}.castellano.wav"
        self.reader.synth(text, source)
        torchaudio.save(str(out), self.vc.generate(str(source)), self.vc.sr)


class CloneVoice:
    def __init__(self, sample: Path) -> None:
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        torch.set_num_threads(4)
        self.model = None
        try:
            folder, t3 = _spain_checkpoint(sample.parent)
            self.model = ChatterboxMultilingualTTS.from_local(folder, "cpu", t3_model=t3)
            print("voz clonada: modelo de español de España", flush=True)
        except Exception as e:  # sin el afinado, el general V3
            print(f"aviso: no se pudo cargar el modelo de España ({type(e).__name__}: {str(e)[:120]})", flush=True)
            self.model = ChatterboxMultilingualTTS.from_pretrained(device="cpu", t3_model="v3")
            print("voz clonada: modelo multilingüe V3", flush=True)
        self.sample = str(sample)

    def synth(self, text: str, out: Path) -> None:
        import re

        import torch
        import torchaudio

        # Frases de una en una: el modelo pierde calidad con textos largos
        sentences = [s for s in re.split(r"(?<=[.!?…])\s+", text.strip()) if s]
        waves = [
            self.model.generate(
                s, language_id="es", audio_prompt_path=self.sample, exaggeration=0.45, cfg_weight=0.5, temperature=0.7
            )
            for s in sentences
        ]
        torchaudio.save(str(out), torch.cat(waves, dim=-1), self.model.sr)


def make_voice(mode: str, voice: str, sample: Path | None):
    if mode == "clone":
        import os

        if not sample:
            raise RuntimeError("Falta la muestra de voz para clonar")
        if os.environ.get("STUDIO_CLONE_ENGINE", "vc") == "tts":
            return CloneVoice(sample)
        try:
            return ConvertedVoice(sample, voice)
        except Exception as e:  # sin el conversor, el clonador de texto a voz
            print(f"aviso: conversión de voz no disponible ({type(e).__name__}: {str(e)[:120]})", flush=True)
            return CloneVoice(sample)
    return KokoroVoice(voice)
