"""Pruebas de los subtítulos: python -m unittest discover studio"""

import unittest

from captions import Word, align, build_ass, chunk, normalize


class CaptionsTest(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize("¡Música!"), "musica")
        self.assertEqual(normalize("Año,"), "ano")

    def test_align_uses_heard_times_and_fills_gaps(self):
        script = "Hoy te cuento tres errores del gym".split()
        heard = [Word("hoy", 0.0, 0.3), Word("te", 0.3, 0.4), Word("cuento", 0.4, 0.8), Word("errores", 1.2, 1.7), Word("gym", 2.0, 2.4)]
        out = align(script, heard, 2.5)
        self.assertEqual([w.text for w in out], script)
        self.assertAlmostEqual(out[2].start, 0.4)
        # «tres» no se oyó: cae entre «cuento» y «errores»
        self.assertGreaterEqual(out[3].start, 0.8)
        self.assertLessEqual(out[3].end, 1.2 + 1e-9)
        # tiempos crecientes
        self.assertTrue(all(a.start <= b.start for a, b in zip(out, out[1:])))

    def test_align_without_whisper_spreads_by_length(self):
        out = align(["a", "bbbb"], [], 5.0)
        self.assertAlmostEqual(out[0].end, 1.0)
        self.assertAlmostEqual(out[1].end, 5.0)

    def test_chunk_breaks_on_punctuation(self):
        words = [Word(t, i, i + 1) for i, t in enumerate("Hola. Esto es una prueba".split())]
        groups = chunk(words, 3, 30)
        self.assertEqual([[w.text for w in g] for g in groups], [["Hola."], ["Esto", "es", "una"], ["prueba"]])

    def test_ass_has_one_event_per_word(self):
        words = [Word("uno", 0, 0.5), Word("dos", 0.5, 1.0)]
        ass = build_ass(words, 1080, 1920, True)
        self.assertEqual(ass.count("Dialogue:"), 2)
        self.assertIn("UNO", ass)


if __name__ == "__main__":
    unittest.main()
