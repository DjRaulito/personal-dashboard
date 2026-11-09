import "server-only";
import { z } from "zod";

// IA gratuita para estimaciones y propuestas. Gemini (Google AI Studio, free tier) como principal
// y Groq (free tier, compatible con OpenAI) como respaldo. Sin claves, las funciones de IA
// devuelven un aviso y el resto de la app funciona igual.

export class AiUnavailableError extends Error {}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

async function gemini(system: string, prompt: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini sin respuesta");
  return text;
}

async function groq(system: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq sin respuesta");
  return text;
}

/** Extrae el primer objeto JSON de un texto (por si el modelo añade ``` alrededor). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("La respuesta no contiene JSON");
  return JSON.parse(text.slice(start, end + 1));
}

/** Pide a la IA un JSON que cumpla el esquema; prueba Gemini y, si falla, Groq. */
export async function askJson<T>(schema: z.ZodType<T>, system: string, prompt: string): Promise<T> {
  const providers = [process.env.GEMINI_API_KEY ? gemini : null, process.env.GROQ_API_KEY ? groq : null].filter(
    (p): p is typeof gemini => p !== null,
  );
  if (providers.length === 0) {
    throw new AiUnavailableError("Falta configurar la IA: añade GEMINI_API_KEY (gratis en Google AI Studio).");
  }
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return schema.parse(extractJson(await provider(system, prompt)));
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`La IA no respondió bien (${lastError instanceof Error ? lastError.message : "error"}).`);
}
