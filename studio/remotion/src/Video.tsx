import { loadFont } from "@remotion/google-fonts/Montserrat";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { chunkWords } from "./chunks";
import type { Scene, VideoProps, Word } from "./types";

const { fontFamily } = loadFont("normal", { weights: ["700", "800", "900"], subsets: ["latin", "latin-ext"] });

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function Video(props: VideoProps) {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const { scenes, transition } = props;
  const vertical = props.height > props.width;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B0F", fontFamily }}>
      {scenes.map((scene, i) => (
        <Sequence
          key={`scene-${i}`}
          from={f(scene.start)}
          durationInFrames={Math.max(1, f(scene.seconds + (i < scenes.length - 1 ? transition : 0)))}
        >
          <SceneLayer
            scene={scene}
            index={i}
            accent={props.accent}
            transition={i > 0 ? f(transition) : 0}
            mediaBase={props.mediaBase}
          />
        </Sequence>
      ))}

      <Shade vertical={vertical} />

      {props.hook && scenes[0] && (
        <Sequence from={0} durationInFrames={f(Math.min(scenes[0].seconds, 2.8))}>
          <Hook text={props.hook} accent={props.accent} vertical={vertical} />
        </Sequence>
      )}

      {scenes.map((scene, i) =>
        i > 0 && scene.headline ? (
          <Sequence
            key={`head-${i}`}
            from={f(scene.start + 0.15)}
            durationInFrames={f(Math.min(scene.seconds - 0.15, 3))}
          >
            <Headline text={scene.headline} accent={props.accent} vertical={vertical} />
          </Sequence>
        ) : null,
      )}

      <Captions words={props.words} accent={props.accent} vertical={vertical} />
      <Progress accent={props.accent} total={f(props.seconds)} vertical={vertical} />
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Escena: sus planos uno tras otro, con una entrada distinta en cada corte
// ---------------------------------------------------------------------------

function SceneLayer({
  scene,
  index,
  accent,
  transition,
  mediaBase,
}: {
  scene: Scene;
  index: number;
  accent: string;
  transition: number;
  mediaBase?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let from = 0;
  const pieces = scene.pieces.map((piece, k) => {
    const start = from;
    const frames = Math.max(1, Math.round(piece.seconds * fps));
    from += frames;
    return (
      <Sequence key={k} from={start} durationInFrames={frames}>
        <Push zoomIn={(index + k) % 2 === 0} frames={frames}>
          <OffthreadVideo
            src={mediaBase ? mediaBase + piece.src : staticFile(piece.src)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Push>
      </Sequence>
    );
  });

  const style: CSSProperties = {};
  if (transition > 0 && frame < transition + 2) {
    const p = spring({ frame, fps, durationInFrames: transition, config: { damping: 200 } });
    switch (index % 4) {
      case 1: // barrido desde la derecha con borde de color
        style.clipPath = `inset(0 0 0 ${(1 - p) * 100}%)`;
        style.boxShadow = `inset ${Math.round((1 - p) * 24)}px 0 0 ${accent}`;
        break;
      case 2: // zoom con desenfoque
        style.transform = `scale(${interpolate(p, [0, 1], [1.3, 1])})`;
        style.filter = `blur(${interpolate(p, [0, 1], [18, 0])}px)`;
        style.opacity = interpolate(p, [0, 0.4], [0, 1], clamp);
        break;
      case 3: // sube desde abajo
        style.transform = `translateY(${(1 - p) * 100}%)`;
        break;
      default: // círculo que se abre
        style.clipPath = `circle(${p * 75}% at 50% 50%)`;
    }
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      {pieces.length ? pieces : <Fallback accent={accent} />}
    </AbsoluteFill>
  );
}

// Zoom lento de cámara (un 6 %), hacia dentro o hacia fuera según el plano
function Push({ zoomIn, frames, children }: { zoomIn: boolean; frames: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, frames], [0, 1], clamp);
  const scale = zoomIn ? 1 + 0.06 * t : 1.06 - 0.06 * t;
  return <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
}

function Fallback({ accent }: { accent: string }) {
  const frame = useCurrentFrame();
  const angle = 140 + frame * 0.4;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, #16161B 0%, #2A3150 55%, ${accent}55 100%)` }} />
  );
}

// Viñeta y degradados arriba/abajo para que el texto se lea sobre cualquier plano
function Shade({ vertical }: { vertical: boolean }) {
  return (
    <AbsoluteFill
      style={{
        background: [
          "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)",
          `linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) ${vertical ? 28 : 35}%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)`,
        ].join(","),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Gancho: palabras que entran de una en una; la más larga, sobre una banda de color
// ---------------------------------------------------------------------------

function Hook({ text, accent, vertical }: { text: string; accent: string; vertical: boolean }) {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const words = text.trim().split(/\s+/);
  const key = words.reduce((best, w, i) => (w.length > words[best].length ? i : best), 0);
  const size = vertical ? width * 0.105 : width * 0.06;
  const out = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], clamp);
  const dim = interpolate(frame, [0, 6, durationInFrames - 8, durationInFrames], [0, 0.45, 0.45, 0], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})`, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `${size * 0.12}px ${size * 0.28}px`,
          width: "86%",
          opacity: out,
          transform: `translateY(${(1 - out) * -40}px)`,
        }}
      >
        {words.map((word, i) => {
          const p = spring({ frame: frame - i * 3, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
          const isKey = i === key;
          return (
            <span
              key={i}
              style={{
                fontSize: size,
                fontWeight: 900,
                lineHeight: 1.05,
                textTransform: "uppercase",
                color: isKey ? "#0B0B0F" : "#FFFFFF",
                backgroundColor: isKey ? accent : "transparent",
                padding: isKey ? `0 ${size * 0.18}px` : 0,
                borderRadius: size * 0.12,
                transform: `scale(${interpolate(p, [0, 1], [0.4, 1])}) rotate(${isKey ? -2 : 0}deg)`,
                opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
                textShadow: isKey ? "none" : "0 6px 24px rgba(0,0,0,0.6)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Titular de escena: barra de color que se dibuja y palabras que suben escalonadas
// ---------------------------------------------------------------------------

function Headline({ text, accent, vertical }: { text: string; accent: string; vertical: boolean }) {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const words = text.trim().split(/\s+/);
  const size = vertical ? width * 0.072 : width * 0.042;
  const bar = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  const out = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        alignItems: vertical ? "center" : "flex-start",
        justifyContent: "flex-start",
        paddingTop: vertical ? "17%" : "6%",
        paddingLeft: vertical ? 0 : "6%",
        opacity: out,
      }}
    >
      <div
        style={{ width: size * 1.6 * bar, height: Math.max(6, size * 0.1), backgroundColor: accent, borderRadius: 4 }}
      />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: vertical ? "center" : "flex-start",
          gap: `0 ${size * 0.25}px`,
          maxWidth: vertical ? "84%" : "60%",
          marginTop: size * 0.3,
        }}
      >
        {words.map((word, i) => {
          const p = spring({ frame: frame - 3 - i * 2, fps, config: { damping: 16, stiffness: 160 } });
          return (
            <span key={i} style={{ overflow: "hidden", display: "inline-block", paddingBottom: size * 0.08 }}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: size,
                  fontWeight: 900,
                  lineHeight: 1.08,
                  textTransform: "uppercase",
                  color: "#FFFFFF",
                  transform: `translateY(${(1 - p) * 110}%)`,
                  textShadow: "0 4px 18px rgba(0,0,0,0.55)",
                }}
              >
                {word}
              </span>
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Subtítulos: golpes de 1-3 palabras; la que suena, en color y un poco más grande
// ---------------------------------------------------------------------------

function Captions({ words, accent, vertical }: { words: Word[]; accent: string; vertical: boolean }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const chunk = chunkWords(words).find((c) => t >= c.start && t < c.end);
  if (!chunk) return null;
  const local = frame - Math.round(chunk.start * fps);
  const pop = spring({ frame: local, fps, config: { damping: 14, stiffness: 220, mass: 0.5 } });
  const size = vertical ? width * 0.078 : height * 0.065;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: vertical ? "118%" : "44%" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `0 ${size * 0.34}px`,
          maxWidth: "88%",
          transform: `scale(${interpolate(pop, [0, 1], [0.82, 1])})`,
          opacity: interpolate(pop, [0, 0.25], [0, 1], clamp),
        }}
      >
        {chunk.words.map((word, i) => {
          const active = t >= word.start && t < Math.max(word.end, word.start + 0.12);
          return (
            <span
              key={i}
              style={{
                fontSize: size,
                fontWeight: 800,
                lineHeight: 1.1,
                color: active ? accent : "#FFFFFF",
                transform: `scale(${active ? 1.08 : 1})`,
                WebkitTextStroke: `${Math.max(2, size * 0.045)}px rgba(0,0,0,0.85)`,
                paintOrder: "stroke fill",
                textShadow: "0 5px 16px rgba(0,0,0,0.55)",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Progress({ accent, total, vertical }: { accent: string; total: number; vertical: boolean }) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: vertical ? "flex-start" : "flex-end" }}>
      <div
        style={{
          height: Math.max(6, height / 320),
          width: `${Math.min(100, (frame / Math.max(1, total)) * 100)}%`,
          backgroundColor: accent,
          opacity: 0.9,
        }}
      />
    </AbsoluteFill>
  );
}
