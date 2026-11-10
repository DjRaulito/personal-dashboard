"""Pruebas de los efectos: python -m unittest test_fx (desde studio/)"""

import tempfile
import unittest
from pathlib import Path

from PIL import Image

import fx


class FxTest(unittest.TestCase):
    def test_easing_ends_at_one(self):
        self.assertAlmostEqual(fx.ease_out_back(1), 1)
        self.assertGreater(max(fx.ease_out_back(t / 20) for t in range(21)), 1)  # rebota

    def test_overlay_frames(self):
        sprite = Image.new("RGBA", (200, 80), (255, 200, 0, 255))
        plan = fx.OverlayPlan(320, 568, 4.0, [fx.Sprite(sprite, 1.0, 2.0, 160, 200)])
        self.assertIsNone(fx.render_overlay_frame(plan, 0.5))
        self.assertIsNone(fx.render_overlay_frame(plan, 3.05))  # sin destellos en los cortes
        frame = fx.render_overlay_frame(plan, 1.6)
        self.assertEqual(len(frame), 320 * 568 * 4)
        self.assertGreater(max(frame[3::4]), 200)  # el titular es visible
        entering = fx.render_overlay_frame(plan, 1.05)
        self.assertLess(max(entering[3::4]), 200)  # entra con un fundido

    def test_callout_sprite(self):
        font = Path(__file__).parent / "fonts" / "Montserrat.ttf"
        fonts = [p for p in [font, Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")] if p.exists()]
        if not fonts:
            self.skipTest("sin fuentes")
        img = fx.callout_sprite("DOBLE DE FUERZA EN 8 SEMANAS", fonts[0], 60, 500, (246, 190, 72))
        self.assertEqual(img.mode, "RGBA")
        self.assertLessEqual(img.width, 500 + 2 * int(60 * 1.6))  # texto dentro del ancho + margen del halo

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
