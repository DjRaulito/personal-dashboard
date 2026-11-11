import type { Word } from "./types";

export type Chunk = { words: Word[]; start: number; end: number };

/**
 * Agrupa las palabras en golpes cortos de subtítulo (estilo redes): como mucho `max` palabras o
 * ~16 letras, y se corta en los signos de puntuación y en las pausas largas de la voz.
 */
export function chunkWords(words: Word[], max = 3, maxChars = 16, pause = 0.35): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Word[] = [];
  const flush = () => {
    if (current.length) {
      chunks.push({ words: current, start: current[0].start, end: current[current.length - 1].end });
      current = [];
    }
  };
  for (const word of words) {
    const prev = current[current.length - 1];
    const chars = current.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length;
    if (prev && (current.length >= max || chars > maxChars || word.start - prev.end > pause)) flush();
    current.push(word);
    if (/[.!?…,;:]$/.test(word.text)) flush();
  }
  flush();
  // Cada golpe se queda en pantalla hasta que empieza el siguiente (sin parpadeos), como mucho 0,6 s más
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    chunks[i].end = next ? Math.min(next.start, chunks[i].end + 0.6) : chunks[i].end + 0.6;
  }
  return chunks;
}
