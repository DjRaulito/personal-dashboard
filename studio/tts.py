"""Voces del VoiceStudio. Modelos abiertos que corren en la CPU de GitHub Actions:

- «ai»: Kokoro-82M (Apache 2.0), voces en español.
- «clone»: Chatterbox Multilingual (MIT), clona la voz a partir de una muestra de ~10-60 s.
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


class CloneVoice:
    def __init__(self, sample: Path) -> None:
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        torch.set_num_threads(4)
        self.model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
        self.sample = str(sample)

    def synth(self, text: str, out: Path) -> None:
        import torchaudio

        # Frases de una en una: el modelo pierde calidad con textos largos
        import re

        import torch

        sentences = [s for s in re.split(r"(?<=[.!?…])\s+", text.strip()) if s]
        waves = [
            self.model.generate(s, language_id="es", audio_prompt_path=self.sample, exaggeration=0.5, cfg_weight=0.5)
            for s in sentences
        ]
        torchaudio.save(str(out), torch.cat(waves, dim=-1), self.model.sr)


def make_voice(mode: str, voice: str, sample: Path | None):
    if mode == "clone":
        if not sample:
            raise RuntimeError("Falta la muestra de voz para clonar")
        return CloneVoice(sample)
    return KokoroVoice(voice)
