// Datos que el worker (studio/worker.py) pasa a Remotion en props.json. Tiempos en segundos.

export type Piece = {
  /** Archivo dentro de la carpeta de trabajo (public dir del render), p. ej. «seg_0_0.mp4». */
  src: string;
  seconds: number;
};

export type Scene = {
  start: number;
  /** Lo que dura la narración de la escena; los planos llevan además el solape de la transición. */
  seconds: number;
  pieces: Piece[];
  headline: string;
};

export type Word = { text: string; start: number; end: number };

export type VideoProps = {
  width: number;
  height: number;
  fps: number;
  seconds: number;
  /** Color de acento (#RRGGBB) de la paleta del vídeo. */
  accent: string;
  hook: string;
  scenes: Scene[];
  words: Word[];
  /** Solape de la transición entre escenas (s). */
  transition: number;
  /**
   * Dirección base de los planos (p. ej. «http://127.0.0.1:3917/public/»). En Windows, «localhost» va a
   * IPv6 y el proxy de Remotion no los encuentra; el worker pasa 127.0.0.1. Vacío: staticFile.
   */
  mediaBase?: string;
};
