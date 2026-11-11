import "server-only";
import { z } from "zod";
import { aiConfigured, askJson, type AiImage } from "@/lib/ai/llm";
import type { Clip } from "./catalog";
import { toClip, type StockCandidate } from "./stock";

// Elección de planos con IA: la búsqueda de stock trae varios candidatos por escena y un modelo que ve
// imágenes (Gemini) mira sus miniaturas y se queda con los que muestran lo que dice la voz. Si la IA no
// responde, se usan los primeros candidatos (ordenados por orientación y etiquetas).

/** Candidatos que se enseñan a la IA por escena. */
export const CANDIDATES_PER_SCENE = 6;
/** Miniaturas por llamada (Gemini admite muchas más; así cada llamada es rápida). */
const IMAGES_PER_CALL = 24;
const THUMB_MAX_BYTES = 400_000;

export interface SceneChoice {
  text: string;
  /** Planos que necesita la escena (1-3). */
  count: number;
  candidates: StockCandidate[];
}

/** Primeros candidatos de cada escena, sin repetir clip entre escenas. */
export function firstCandidates(scenes: SceneChoice[]): Clip[][] {
  const used = new Set<string>();
  return scenes.map(({ count, candidates }) => {
    const picked = candidates.filter((c) => !used.has(c.id)).slice(0, count);
    picked.forEach((c) => used.add(c.id));
    return picked.map(toClip);
  });
}

/**
 * Aplica lo que eligió la IA: `picks[i]` son índices de candidatos de la escena i (del mejor al peor);
 * `undefined` si la IA no habló de esa escena (se usan los primeros). Sin repetir clip entre escenas.
 * Una lista vacía deja la escena sin clips: el montaje pondrá una imagen IA.
 */
export function applyPicks(scenes: SceneChoice[], picks: (number[] | undefined)[]): Clip[][] {
  const used = new Set<string>();
  return scenes.map(({ count, candidates }, i) => {
    const order = picks[i] ?? candidates.map((_, k) => k);
    const picked: StockCandidate[] = [];
    for (const k of order) {
      const c = candidates[k];
      if (!c || used.has(c.id) || picked.includes(c)) continue;
      picked.push(c);
      if (picked.length === count) break;
    }
    picked.forEach((c) => used.add(c.id));
    return picked.map(toClip);
  });
}

async function fetchThumb(url: string): Promise<AiImage | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > THUMB_MAX_BYTES) return null;
    return { mime: res.headers.get("content-type")?.split(";")[0] || "image/jpeg", data: buf.toString("base64") };
  } catch {
    return null;
  }
}

const pickSchema = z.object({
  scenes: z.array(z.object({ scene: z.coerce.number().int(), picks: z.array(z.coerce.number().int()).max(10) })),
});

const SYSTEM = [
  "Eres montador de vídeos para redes sociales. Eliges planos de vídeo de stock para cada escena de un vídeo narrado.",
  "Recibes miniaturas numeradas por orden de llegada (la primera imagen es la 1).",
  "Para cada escena, elige las imágenes que muestren de forma literal lo que dice la voz en esa frase, del mejor al peor, hasta el número pedido.",
  "Mira la imagen, no solo las etiquetas. Descarta animación, 3D, dibujos, pantallas con texto, logotipos o marcas de agua,",
  "y planos que no encajan con la frase o con el tema (personas, lugar o actividad distintos: un niño, una pista de tenis o una pared",
  "cuando se habla de un adulto en el gimnasio). Mejor un plano sencillo que encaje que uno bonito que no tenga que ver.",
  "Si ninguna imagen de una escena sirve, devuelve picks vacío para esa escena.",
  'Devuelve JSON {"scenes": [{"scene": 1, "picks": [3, 1]}]} con el número de escena y los números de imagen elegidos.',
].join(" ");

interface Slot {
  scene: number;
  candidate: number;
  image: AiImage;
}

/** Una llamada a la IA con un grupo de escenas; devuelve los índices elegidos por escena. */
async function askGroup(topic: string, scenes: SceneChoice[], slots: Slot[]): Promise<Map<number, number[]>> {
  const lines = [`Tema del vídeo: ${topic}`, ""];
  const sceneIds = [...new Set(slots.map((s) => s.scene))];
  for (const i of sceneIds) {
    const mine = slots.map((s, n) => ({ ...s, n: n + 1 })).filter((s) => s.scene === i);
    lines.push(`Escena ${i + 1} (elige hasta ${scenes[i].count}): «${scenes[i].text}»`);
    for (const s of mine) {
      const tags = scenes[i].candidates[s.candidate].tags.split(",").slice(0, 6).join(",").trim();
      lines.push(`  imagen ${s.n}${tags ? ` (etiquetas: ${tags})` : ""}`);
    }
  }
  const answer = await askJson(
    pickSchema,
    SYSTEM,
    lines.join("\n"),
    slots.map((s) => s.image),
  );
  const result = new Map<number, number[]>();
  for (const { scene, picks } of answer.scenes) {
    const i = scene - 1;
    if (!sceneIds.includes(i)) continue;
    const chosen = picks
      .map((n) => slots[n - 1])
      .filter((s): s is Slot => Boolean(s) && s.scene === i)
      .map((s) => s.candidate);
    result.set(i, chosen);
  }
  return result;
}

/**
 * Elige los clips de cada escena. Con IA de visión configurada, mira las miniaturas; si no hay IA, no
 * hay miniaturas o la IA falla, usa los primeros candidatos. Nunca lanza.
 */
export async function chooseClips(topic: string, scenes: SceneChoice[]): Promise<{ clips: Clip[][]; ai: boolean }> {
  if (!aiConfigured() || !scenes.some((s) => s.candidates.length)) {
    return { clips: firstCandidates(scenes), ai: false };
  }
  // Miniaturas en paralelo (aunque haya pocos candidatos, la IA puede descartar los que no encajan)
  const slots: Slot[] = [];
  await Promise.all(
    scenes.map(async (scene, i) => {
      const images = await Promise.all(
        scene.candidates.slice(0, CANDIDATES_PER_SCENE + 2).map((c) => (c.thumb ? fetchThumb(c.thumb) : null)),
      );
      images.forEach((image, k) => image && slots.push({ scene: i, candidate: k, image }));
    }),
  );
  slots.sort((a, b) => a.scene - b.scene || a.candidate - b.candidate);
  if (!slots.length) return { clips: firstCandidates(scenes), ai: false };

  // Grupos de escenas completas de hasta IMAGES_PER_CALL miniaturas
  const groups: Slot[][] = [];
  for (const slot of slots) {
    const last = groups.at(-1);
    const sameScene = last?.at(-1)?.scene === slot.scene;
    if (last && (sameScene || last.length + countFor(slots, slot.scene) <= IMAGES_PER_CALL)) last.push(slot);
    else groups.push([slot]);
  }
  const results = await Promise.all(groups.map((g) => askGroup(topic, scenes, g).catch(() => null)));
  if (results.every((r) => r === null)) return { clips: firstCandidates(scenes), ai: false };
  const picks = scenes.map((_, i) => {
    for (const r of results) if (r?.has(i)) return r.get(i);
    return undefined;
  });
  return { clips: applyPicks(scenes, picks), ai: true };
}

const countFor = (slots: Slot[], scene: number) => slots.filter((s) => s.scene === scene).length;
