"""Pruebas del estudio local: lectura de .env, rutas de ffmpeg en Windows y la voz de VoiceStudio."""

from __future__ import annotations

import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path, PureWindowsPath
from unittest import mock

import local
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


if __name__ == "__main__":
    unittest.main()
