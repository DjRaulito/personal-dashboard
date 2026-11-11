"""Pruebas del estudio local: lectura de .env, rutas de ffmpeg en Windows y la voz de VoiceStudio."""

from __future__ import annotations

import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path, PureWindowsPath
from unittest import mock

import captions
import local
import motion
import render
import tts


class EnvTest(unittest.TestCase):
    def test_load_env(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ".env.local"
            path.write_text(
                '# comentario\nSTUDIO_LOCAL_TOKEN="studio_pc_abc"\nexport OTRA=valor=con=iguales\nVACIA=\nmal\n',
                encoding="utf-8",
            )
            env = local.load_env(path)
        self.assertEqual(env["STUDIO_LOCAL_TOKEN"], "studio_pc_abc")
        self.assertEqual(env["OTRA"], "valor=con=iguales")
        self.assertEqual(env["VACIA"], "")
        self.assertNotIn("mal", env)

    def test_load_env_missing(self) -> None:
        self.assertEqual(local.load_env(Path("no-existe.env")), {})

    def test_describe(self) -> None:
        health = {"version": "0.5.7", "device": "cuda (NVIDIA GeForce RTX 4070 SUPER)"}
        self.assertEqual(local.describe(health), "VoiceStudio 0.5.7 · NVIDIA GeForce RTX 4070 SUPER")


class StockTest(unittest.TestCase):
    def test_tag_score(self) -> None:
        self.assertEqual(local.tag_score("man lifting barbell", "man, lift, barbells"), 1.0)
        self.assertEqual(local.tag_score("man sleeping", "woman, bed, sleep"), 0.5)
        self.assertEqual(local.tag_score("frustrated man gym", "tennis, court"), 0.0)

    def test_rank_hits(self) -> None:
        def hit(url: str, w: int, h: int, tags: str, **extra) -> dict:
            return {"duration": 8, "tags": tags, "videos": {"large": {"url": url, "width": w, "height": h}}, **extra}

        hits = [
            hit("wall", 1080, 1920, "brick, wall"),
            hit("ai", 1080, 1920, "man, sleeping", isAiGenerated=True),
            hit("flat", 1920, 1080, "man, sleeping"),
            hit("match", 1080, 1920, "sleeping, man, bed"),
        ]
        self.assertEqual([c["url"] for c in local.rank_hits(hits, "man sleeping", vertical=True)], ["match", "flat", "wall"])


class FilterPathTest(unittest.TestCase):
    def test_windows_drive_is_escaped(self) -> None:
        fake = mock.Mock()
        fake.resolve.return_value.as_posix.return_value = PureWindowsPath(r"C:\Temp\studio\subs.ass").as_posix()
        with mock.patch.object(render, "Path", return_value=fake):
            self.assertEqual(render.filter_path(Path("subs.ass")), "'C\\:/Temp/studio/subs.ass'")

    def test_posix_path_is_quoted(self) -> None:
        self.assertTrue(render.filter_path(Path("/tmp/x.ass")).startswith("'"))


class _FakeVoiceStudio(BaseHTTPRequestHandler):
    requests: list[bytes] = []

    def log_message(self, *args) -> None:  # silencio
        pass

    def _json(self, data) -> None:
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json({"status": "ok", "version": "0.5.7", "device": "cpu"})
        elif self.path == "/profiles":
            self._json(
                [
                    {"id": "demo0001", "kind": "clone", "is_demo": 1, "created_at": 2},
                    {"id": "viejo", "kind": "clone", "is_demo": 0, "created_at": 1},
                    {"id": "mio", "kind": "clone", "is_demo": 0, "created_at": 3},
                    {"id": "disenada", "kind": "design", "is_demo": 0, "created_at": 4},
                ]
            )
        else:
            self.send_error(404)

    def do_POST(self) -> None:
        body = self.rfile.read(int(self.headers["Content-Length"]))
        type(self).requests.append(body)
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.end_headers()
        self.wfile.write(b"RIFF....WAVEfmt ")


class VoiceStudioTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = HTTPServer(("127.0.0.1", 0), _FakeVoiceStudio)
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()

    def setUp(self) -> None:
        _FakeVoiceStudio.requests = []

    def test_clone_uses_newest_own_profile(self) -> None:
        voice = tts.VoiceStudioVoice("clone", "es_male", None, base=self.base)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "v.wav"
            voice.synth("Hola, qué tal", out)
            self.assertTrue(out.read_bytes().startswith(b"RIFF"))
        body = _FakeVoiceStudio.requests[0].decode()
        self.assertIn('name="profile_id"\r\n\r\nmio\r\n', body)
        self.assertIn('name="language"\r\n\r\nSpanish\r\n', body)
        self.assertIn("Hola, qué tal", body)

    def test_ai_designs_voice(self) -> None:
        voice = tts.VoiceStudioVoice("ai", "es_female", None, base=self.base)
        with tempfile.TemporaryDirectory() as tmp:
            voice.synth("Hola", Path(tmp) / "v.wav")
        body = _FakeVoiceStudio.requests[0].decode()
        self.assertIn("female, young adult, moderate pitch", body)
        self.assertNotIn('name="profile_id"', body)


class MotionTest(unittest.TestCase):
    def test_build_props(self) -> None:
        script = {
            "hook": " ¿Sin resultados? ",
            "scenes": [{"text": "a", "emphasis": ""}, {"text": "b", "emphasis": " Error 1 "}],
        }
        pieces = [[{"src": "seg_0_0.mp4", "seconds": 3.4}], [{"src": "seg_1_0.mp4", "seconds": 2.0}]]
        words = [captions.Word("Hola", 0.1, 0.4)]
        props = motion.build_props(script, [0.0, 3.0], [3.0, 2.0], pieces, words, 1080, 1920, 5.0, (246, 190, 72))
        self.assertEqual(props["accent"], "#F6BE48")
        self.assertEqual(props["hook"], "¿Sin resultados?")
        self.assertEqual(props["scenes"][1], {"start": 3.0, "seconds": 2.0, "pieces": pieces[1], "headline": "Error 1"})
        self.assertEqual(props["words"], [{"text": "Hola", "start": 0.1, "end": 0.4}])
        self.assertEqual(props["transition"], motion.TRANSITION)

    def test_free_port(self) -> None:
        self.assertGreater(motion.free_port(), 0)

    def test_only_when_asked(self) -> None:
        with mock.patch.dict("os.environ", {"STUDIO_RENDERER": "ffmpeg"}):
            self.assertFalse(motion.available())


if __name__ == "__main__":
    unittest.main()
