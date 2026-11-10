"""Subtítulos del VoiceStudio: alinea las palabras del guion con los tiempos que da Whisper y
genera un archivo ASS con frases cortas y la palabra que suena resaltada."""

from __future__ import annotations

import difflib
import re
import unicodedata
from dataclasses import dataclass


@dataclass
class Word:
    text: str
    start: float
    end: float


def normalize(word: str) -> str:
    """Minúsculas, sin tildes ni signos, para comparar el guion con lo que oye Whisper."""
    decomposed = unicodedata.normalize("NFD", word.lower())
    plain = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", plain)


def tokenize(text: str) -> list[str]:
    return [t for t in re.split(r"\s+", text.strip()) if t]


def align(script_words: list[str], heard: list[Word], total: float) -> list[Word]:
    """Da tiempos a cada palabra del guion. Las que Whisper reconoce toman su tiempo; las demás se
    reparten entre las vecinas conocidas según su longitud."""
    if not script_words:
        return []
    out: list[Word | None] = [None] * len(script_words)
    a = [normalize(w) for w in script_words]
    b = [normalize(w.text) for w in heard]
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for block in matcher.get_matching_blocks():
        for k in range(block.size):
            h = heard[block.b + k]
            out[block.a + k] = Word(script_words[block.a + k], h.start, h.end)

    # Rellenar huecos interpolando entre la palabra conocida anterior y la siguiente
    i = 0
    n = len(out)
    while i < n:
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < n and out[j] is None:
            j += 1
        start = out[i - 1].end if i > 0 else 0.0
        end = out[j].start if j < n else total
        end = max(end, start + 0.05 * (j - i))
        weights = [max(len(script_words[k]), 1) for k in range(i, j)]
        span = end - start
        cursor = start
        for k, w in zip(range(i, j), weights):
            length = span * w / sum(weights)
            out[k] = Word(script_words[k], cursor, cursor + length)
            cursor += length
        i = j
    return [w for w in out if w is not None]


def chunk(words: list[Word], max_words: int, max_chars: int) -> list[list[Word]]:
    """Agrupa en frases cortas; corta antes en puntuación fuerte."""
    groups: list[list[Word]] = []
    current: list[Word] = []
    for w in words:
        too_long = len(" ".join(x.text for x in current + [w])) > max_chars
        if current and (len(current) >= max_words or too_long):
            groups.append(current)
            current = []
        current.append(w)
        if re.search(r"[.!?…:;]$", w.text):
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    return groups


def ass_time(t: float) -> str:
    t = max(t, 0.0)
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")")


def build_ass(words: list[Word], width: int, height: int, vertical: bool, font: str = "Montserrat") -> str:
    """ASS con una línea por frase y la palabra actual en el color del módulo (azul grisáceo)."""
    size = round(height * (0.052 if vertical else 0.06))
    margin_v = round(height * (0.24 if vertical else 0.08))
    max_words, max_chars = (3, 22) if vertical else (6, 42)
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{font},{size},&H00F5F2F2,&H00F5F2F2,&H000E0B0B,&H64000000,-1,0,0,0,100,100,0,0,1,{max(2, size // 12)},{max(1, size // 30)},2,{width // 12},{width // 12},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    highlight = "{\\c&HD4A393&}"  # #93A3D4 en BGR
    normal = "{\\c&HF5F2F2&}"
    for group in chunk(words, max_words, max_chars):
        for idx, current in enumerate(group):
            start = current.start
            end = group[idx + 1].start if idx + 1 < len(group) else current.end
            if end <= start:
                end = start + 0.05
            parts = []
            for k, w in enumerate(group):
                text = escape(w.text.upper() if vertical else w.text)
                parts.append(f"{highlight}{text}{normal}" if k == idx else text)
            lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Main,,0,0,0,,{' '.join(parts)}")
    return header + "\n".join(lines) + "\n"
