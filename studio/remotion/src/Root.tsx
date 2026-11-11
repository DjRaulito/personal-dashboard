import { Composition } from "remotion";
import type { VideoProps } from "./types";
import { Video } from "./Video";

// Ejemplo para `npm run studio` (sin planos: se ve el fondo de respaldo)
const sample: VideoProps = {
  width: 1080,
  height: 1920,
  fps: 30,
  seconds: 8,
  accent: "#F6BE48",
  hook: "¿Sin resultados en el gym?",
  transition: 0.4,
  scenes: [
    { start: 0, seconds: 4, pieces: [], headline: "" },
    { start: 4, seconds: 4, pieces: [], headline: "Error 1: cambiar de rutina" },
  ],
  words: "Llevas meses en el gimnasio sin ver cambios puede que cometas uno de estos errores"
    .split(" ")
    .map((text, i) => ({ text, start: i * 0.45, end: i * 0.45 + 0.4 })),
};

export function Root() {
  return (
    <Composition
      id="Video"
      component={Video}
      defaultProps={sample}
      width={sample.width}
      height={sample.height}
      fps={sample.fps}
      durationInFrames={Math.ceil(sample.seconds * sample.fps)}
      calculateMetadata={({ props }) => ({
        width: props.width,
        height: props.height,
        fps: props.fps,
        durationInFrames: Math.max(1, Math.ceil(props.seconds * props.fps)),
      })}
    />
  );
}
