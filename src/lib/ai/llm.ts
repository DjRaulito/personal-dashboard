import "server-only";
import { z } from "zod";

// IA gratuita para estimaciones, fotos y el asistente. Gemini (Google AI Studio, free tier) como
// principal y Groq (free tier, compatible con OpenAI) como respaldo. Sin claves, las funciones de
// IA devuelven un aviso y el resto de la app funciona igual.

export class AiUnavailableError extends Error {}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const TIMEOUT_MS = 45000;

/** Imagen en base64 (sin el prefijo data:). */
export interface AiImage {
  mime: string;
  data: string;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

function noProviders(): never {
  throw new AiUnavailableError("Falta configurar la IA: añade GEMINI_API_KEY (gratis en Google AI Studio).");
}

// ---------------------------------------------------------------------------
// Llamadas de bajo nivel
// ---------------------------------------------------------------------------

type GeminiPart = Record<string, unknown> & {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
};
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Modelo que funciona de verdad: Google retira modelos y devuelve 404; entonces buscamos otro vigente.
let resolvedModel: string | null = null;

/** Elige un modelo Flash estable de los que Google ofrece ahora (sin lite, preview ni exp). */
export function pickGeminiModel(names: string[]): string | null {
  const ids = names.map((n) => n.replace(/^models\//, ""));
  const flash = ids.filter((id) => /^gemini-[\d.]+-flash$/.test(id));
  const version = (id: string) => parseFloat(id.split("-")[1]);
  flash.sort((a, b) => version(b) - version(a));
  return flash[0] ?? null;
}

async function listGeminiModels(): Promise<string[]> {
  const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name);
}

function postGemini(model: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

async function geminiRequest(body: Record<string, unknown>): Promise<GeminiContent> {
  let res = await postGemini(resolvedModel ?? GEMINI_MODEL, body);
  if (res.status === 404) {
    const alt = pickGeminiModel(await listGeminiModels());
    if (alt && alt !== (resolvedModel ?? GEMINI_MODEL)) {
      res = await postGemini(alt, body);
      if (res.ok) resolvedModel = alt;
    }
  }
  // 503 (saturado) y 429 (límite): suelen ser momentáneos; reintenta con espera corta
  for (const wait of [1200, 2500]) {
    if (res.status !== 503 && res.status !== 429) break;
    await new Promise((r) => setTimeout(r, wait));
    res = await postGemini(resolvedModel ?? GEMINI_MODEL, body);
  }
  // Sigue saturado: prueba con la versión lite, que suele tener hueco
  if (res.status === 503 || res.status === 429) {
    const lite = `${resolvedModel ?? GEMINI_MODEL}-lite`;
    const resLite = await postGemini(lite, body);
    if (resLite.ok) res = resLite;
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: GeminiContent }[] };
  const content = data.candidates?.[0]?.content;
  if (!content?.parts?.length) throw new Error("Gemini sin respuesta");
  return { role: "model", parts: content.parts };
}

const geminiText = (c: GeminiContent) =>
  c.parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null | Record<string, unknown>[];
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

async function groqRequest(body: Record<string, unknown>) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: OpenAiMessage }[] };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Groq sin respuesta");
  return message;
}

// ---------------------------------------------------------------------------
// JSON con esquema (opcionalmente con una foto)
// ---------------------------------------------------------------------------

/** Extrae el primer objeto JSON de un texto (por si el modelo añade ``` alrededor). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("La respuesta no contiene JSON");
  return JSON.parse(text.slice(start, end + 1));
}

async function geminiJson(system: string, prompt: string, image?: AiImage): Promise<string> {
  const parts: GeminiPart[] = [{ text: prompt }];
  if (image) parts.unshift({ inline_data: { mime_type: image.mime, data: image.data } });
  const content = await geminiRequest({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: image ? 0.2 : 0.7 },
  });
  return geminiText(content);
}

async function groqJson(system: string, prompt: string, image?: AiImage): Promise<string> {
  const message = await groqRequest({
    model: image ? GROQ_VISION_MODEL : GROQ_MODEL,
    temperature: image ? 0.2 : 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: image
          ? [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.data}` } },
            ]
          : prompt,
      },
    ],
  });
  if (typeof message.content !== "string" || !message.content) throw new Error("Groq sin respuesta");
  return message.content;
}

/** Pide a la IA un JSON que cumpla el esquema; prueba Gemini y, si falla, Groq. */
export async function askJson<T>(schema: z.ZodType<T>, system: string, prompt: string, image?: AiImage): Promise<T> {
  const providers = [process.env.GEMINI_API_KEY ? geminiJson : null, process.env.GROQ_API_KEY ? groqJson : null].filter(
    (p): p is typeof geminiJson => p !== null,
  );
  if (providers.length === 0) noProviders();
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return schema.parse(extractJson(await provider(system, prompt, image)));
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`La IA no respondió bien (${lastError instanceof Error ? lastError.message : "error"}).`);
}

// ---------------------------------------------------------------------------
// Conversación con herramientas (asistente)
// ---------------------------------------------------------------------------

export interface AiTool {
  name: string;
  description: string;
  /** JSON Schema de los argumentos (objeto). */
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatResult {
  text: string;
  toolsUsed: string[];
}

export interface ChatOptions {
  /** Vueltas máximas de herramientas antes de obligar a responder. */
  maxRounds?: number;
  /** Aviso cada vez que el modelo usa una herramienta (para el registro de los agentes). */
  onTool?: (name: string, args: Record<string, unknown>) => void | Promise<void>;
}

const MAX_TOOL_ROUNDS = 6;
const MAX_TOOL_CHARS = 24000;

/** Ejecuta una herramienta y devuelve su resultado como JSON acotado (los errores también vuelven al modelo). */
async function runTool(tools: AiTool[], name: string, args: Record<string, unknown>): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return JSON.stringify({ error: `No existe la herramienta ${name}` });
  try {
    const json = JSON.stringify(await tool.run(args ?? {}));
    return json.length > MAX_TOOL_CHARS
      ? `${json.slice(0, MAX_TOOL_CHARS)}… [recortado: pide un rango más corto]`
      : json;
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Error al leer los datos" });
  }
}

async function geminiChat(
  system: string,
  turns: ChatTurn[],
  tools: AiTool[],
  { maxRounds = MAX_TOOL_ROUNDS, onTool }: ChatOptions = {},
): Promise<ChatResult> {
  const contents: GeminiContent[] = turns.map((t) => ({
    role: t.role === "user" ? "user" : "model",
    parts: [{ text: t.text }],
  }));
  const declarations = tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
  const used: string[] = [];
  for (let round = 0; round <= maxRounds; round++) {
    const content = await geminiRequest({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: declarations }],
      // En la última vuelta ya no se permiten herramientas: toca responder
      toolConfig: { functionCallingConfig: { mode: round === maxRounds ? "NONE" : "AUTO" } },
      generationConfig: { temperature: 0.3 },
    });
    const calls = content.parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (calls.length === 0) return { text: geminiText(content).trim(), toolsUsed: used };
    // Se devuelve el turno del modelo tal cual (incluye las firmas de razonamiento)
    contents.push(content);
    const responses = await Promise.all(
      calls.map(async (c) => {
        used.push(c.name);
        await onTool?.(c.name, c.args ?? {});
        const result = await runTool(tools, c.name, c.args ?? {});
        return { functionResponse: { name: c.name, response: { result } } };
      }),
    );
    contents.push({ role: "user", parts: responses });
  }
  throw new Error("Gemini no terminó de responder");
}

async function groqChat(
  system: string,
  turns: ChatTurn[],
  tools: AiTool[],
  { maxRounds = MAX_TOOL_ROUNDS, onTool }: ChatOptions = {},
): Promise<ChatResult> {
  const messages: OpenAiMessage[] = [
    { role: "system", content: system },
    ...turns.map((t) => ({ role: t.role, content: t.text }) as OpenAiMessage),
  ];
  const declarations = tools.map(({ name, description, parameters }) => ({
    type: "function",
    function: { name, description, parameters },
  }));
  const used: string[] = [];
  for (let round = 0; round <= maxRounds; round++) {
    const message = await groqRequest({
      model: GROQ_MODEL,
      temperature: 0.3,
      messages,
      tools: declarations,
      tool_choice: round === maxRounds ? "none" : "auto",
    });
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) return { text: String(message.content ?? "").trim(), toolsUsed: used };
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
    for (const c of calls) {
      used.push(c.function.name);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {
        // argumentos mal formados: la herramienta usará sus valores por defecto
      }
      await onTool?.(c.function.name, args);
      messages.push({ role: "tool", tool_call_id: c.id, content: await runTool(tools, c.function.name, args) });
    }
  }
  throw new Error("Groq no terminó de responder");
}

/** Conversación con herramientas: Gemini y, si falla, Groq. */
export async function chatWithTools(
  system: string,
  turns: ChatTurn[],
  tools: AiTool[],
  options?: ChatOptions,
): Promise<ChatResult> {
  const providers = [process.env.GEMINI_API_KEY ? geminiChat : null, process.env.GROQ_API_KEY ? groqChat : null].filter(
    (p): p is typeof geminiChat => p !== null,
  );
  if (providers.length === 0) noProviders();
  let lastError: unknown;
  for (const provider of providers) {
    try {
      const result = await provider(system, turns, tools, options);
      if (result.text) return result;
      lastError = new Error("respuesta vacía");
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`La IA no respondió bien (${lastError instanceof Error ? lastError.message : "error"}).`);
}
