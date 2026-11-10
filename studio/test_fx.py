"""Pruebas de los efectos: python -m unittest test_fx (desde studio/)"""

import tempfile
import unittest
from pathlib import Path

from PIL import Image

import fx


class FxTest(unittest.TestCase):
    def test_emoji_code_matches_twemoji_names(self):
        self.assertEqual(fx.emoji_code("💪"), "1f4aa")
        self.assertEqual(fx.emoji_code("❤️"), "2764")  # sin FE0F fuera de secuencias ZWJ
        self.assertEqual(fx.emoji_code("👨‍💻"), "1f468-200d-1f4bb")

    def test_easing_ends_at_one(self):
        self.assertAlmostEqual(fx.ease_out_back(1), 1)
        self.assertGreater(max(fx.ease_out_back(t / 20) for t in range(21)), 1)  # rebota

    def test_overlay_frames(self):
        sprite = Image.new("RGBA", (200, 80), (255, 200, 0, 255))
        plan = fx.OverlayPlan(320, 568, 4.0, [fx.Sprite(sprite, 1.0, 2.0, 160, 200, tilt=-3)], flashes=[3.0])
        self.assertIsNone(fx.render_overlay_frame(plan, 0.5))
        frame = fx.render_overlay_frame(plan, 1.6)
        self.assertEqual(len(frame), 320 * 568 * 4)
        self.assertGreater(max(frame[3::4]), 200)  # el rótulo es visible
        self.assertIsNotNone(fx.render_overlay_frame(plan, 3.05))  # destello del corte

    def test_audio_lengths(self):
        music = fx.music(3.0, "chill", 1)
        self.assertEqual(len(music), 3 * fx.SR)
        self.assertLessEqual(abs(music).max(), 0.51)
        sfx = fx.sfx_track(2.0, [1.0], [0.5], 1)
        self.assertEqual(len(sfx), 2 * fx.SR)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "m.wav"
            fx.write_wav(music, out)
            self.assertGreater(out.stat().st_size, 3 * fx.SR * 2)



if __name__ == "__main__":
    unittest.main()
