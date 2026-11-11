import "server-only";
import { z } from "zod";

// IA gratuita para estimaciones, fotos, guiones, agentes y el asistente. Cadena de proveedores con
// capa gratuita: Gemini (Google AI Studio) y varios compatibles con OpenAI (Groq, Mistral, OpenRouter,
// Cerebras). Se usan los que tengan clave, en orden; si uno falla (cuota, saturado, caído) se pasa al
// siguiente y se le deja descansar un rato. Sin claves, las funciones de IA devuelven un aviso.

export class AiUnavailableError extends Error {}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const TIMEOUT_MS = 45000;

/** Imagen en base64 (sin el prefijo data:). */
export interface AiImage {
  mime: string;
  data: string;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) || COMPAT.some((p) => process.env[p.keyEnv]);
}

/** Nombres de los proveedores con clave, en el orden en que se prueban. */
export function aiProviderNames(): string[] {
  return providerOrder().map((id) => PROVIDER_LABELS[id]);
}

function noProviders(): never {
  throw new AiUnavailableError(
    "Falta configurar la IA: añade GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY u OPENROUTER_API_KEY (todas gratis).",
  );
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

/** Modelos Flash de texto que ofrece Google, de más nuevo a más viejo; los estables antes que los preview. */
export function geminiCandidates(names: string[]): string[] {
  const ids = names.map((n) => n.replace(/^models\//, ""));
  const ok = ids.filter(
    (id) => /^gemini-[\d.]+-flash/.test(id) && !/lite|image|tts|live|audio|thinking|exp|latest/.test(id),
  );
  const version = (id: string) => parseFloat(id.split("-")[1]);
  const preview = (id: string) => (id.includes("preview") ? 1 : 0);
  return ok.sort((x, y) => preview(x) - preview(y) || version(y) - version(x));
}

async function listGeminiModels(): Promise<string[]> {
  const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name);
}

// Con otros proveedores detrás, no merece la pena esperar mucho a Gemini
const GEMINI_ATTEMPT_MS = 30000;

/** Una llamada a un modelo; devuelve null si no responde a tiempo o se corta la conexión. */
async function postGemini(model: string, body: Record<string, unknown>): Promise<Response | null> {
  // thinkingLevel solo existe en Gemini 3+: con otros modelos daría 400
  const config = body.generationConfig as Record<string, unknown> | undefined;
  const send =
    config && !/^gemini-([3-9]|\d{2})/.test(model)
      ? { ...body, generationConfig: { ...config, thinkingConfig: undefined } }
      : body;
  try {
    return await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(send),
      signal: AbortSignal.timeout(GEMINI_ATTEMPT_MS),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

// Se puede cambiar de modelo si no existe (404), está saturado (503/429) o no contesta a tiempo
const switchable = (r: Response | null) => !r || r.status === 404 || r.status === 503 || r.status === 429;

async function geminiRequest(body: Record<string, unknown>): Promise<GeminiContent> {
  const first = resolvedModel ?? GEMINI_MODEL;
  let model = first;
  let res = await postGemini(model, body);
  if (switchable(res)) {
    // Prueba otros modelos Flash que Google ofrezca ahora (máx. 3) y recuerda el que funcione
    const alts = geminiCandidates(await listGeminiModels().catch(() => []))
      .filter((m) => m !== first)
      .slice(0, 3);
    for (const alt of alts) {
      const r = await postGemini(alt, body);
      if (r?.ok || !switchable(r)) {
        res = r;
        model = alt;
        break;
      }
      res = res ?? r;
    }
  }
  if (res?.ok) resolvedModel = model;
  if (!res) throw new Error("Gemini no respondió a tiempo con ningún modelo");
  if (!res.ok) {
    // El mensaje de Google dice la causa real (modelo, clave, cuota…)
    const detail = await res
      .json()
      .then((d: { error?: { message?: string } }) => d.error?.message?.slice(0, 160))
      .catch(() => undefined);
    throw new Error(`Gemini ${res.status}${detail ? `: ${detail}` : ""}`);
  }
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

// ---------------------------------------------------------------------------
// Proveedores compatibles con OpenAI (capa gratuita)
// ---------------------------------------------------------------------------

type ProviderId = "gemini" | "groq" | "mistral" | "openrouter" | "cerebras";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Gemini",
  groq: "Groq",
  mistral: "Mistral",
  openrouter: "OpenRouter",
  cerebras: "Cerebras",
};

interface CompatProvider {
  id: Exclude<ProviderId, "gemini">;
  base: string;
  keyEnv: string;
  /** Modelos de texto (con herramientas) a probar, el primero el preferido. */
  textModels: () => Promise<string[]>;
  /** Modelos que ven fotos; vacío si el proveedor no tiene. */
  visionModels: () => Promise<string[]>;
  /** Admite response_format json_object. */
  jsonMode: boolean;
  headers?: Record<string, string>;
}

const envList = (name: string, fallback: string[]) =>
  process.env[name]
    ? process.env[name]!.split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : fallback;

interface OpenRouterModel {
  id: string;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[] };
  context_length?: number;
}

let openRouterFree: { at: number; models: OpenRouterModel[] } | null = null;

/** Modelos gratis (:free) de OpenRouter que admiten herramientas; la lista cambia a menudo, se pide en vivo. */
export function openRouterCandidates(models: OpenRouterModel[], vision: boolean): string[] {
  return models
    .filter(
      (m) =>
        m.id.endsWith(":free") &&
        Number(m.pricing?.prompt ?? 1) === 0 &&
        Number(m.pricing?.completion ?? 1) === 0 &&
        (vision ? m.architecture?.input_modalities?.includes("image") : m.supported_parameters?.includes("tools")),
    )
    .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
    .map((m) => m.id)
    .slice(0, 3);
}

async function openRouterModels(vision: boolean): Promise<string[]> {
  const fixed = process.env[vision ? "OPENROUTER_VISION_MODEL" : "OPENROUTER_MODEL"];
  if (fixed) return envList(vision ? "OPENROUTER_VISION_MODEL" : "OPENROUTER_MODEL", []);
  if (!openRouterFree || Date.now() - openRouterFree.at > 6 * 3600_000) {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { data?: OpenRouterModel[] }) : null;
    if (!data?.data?.length) return [];
    openRouterFree = { at: Date.now(), models: data.data };
  }
  return openRouterCandidates(openRouterFree.models, vision);
}

// Modelos por defecto (se pueden cambiar con variables de entorno, separados por comas)
const COMPAT: CompatProvider[] = [
  {
    id: "groq",
    base: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    textModels: async () => envList("GROQ_MODEL", ["openai/gpt-oss-120b", "qwen/qwen3-32b", "llama-3.3-70b-versatile"]),
    visionModels: async () => envList("GROQ_VISION_MODEL", ["meta-llama/llama-4-scout-17b-16e-instruct"]),
    jsonMode: true,
  },
  {
    id: "mistral",
    base: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY",
    textModels: async () => envList("MISTRAL_MODEL", ["mistral-medium-latest", "mistral-small-latest"]),
    visionModels: async () => envList("MISTRAL_VISION_MODEL", ["mistral-small-latest"]),
    jsonMode: true,
  },
  {
    id: "openrouter",
    base: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    textModels: () => openRouterModels(false),
    visionModels: () => openRouterModels(true),
    jsonMode: false,
    headers: { "X-Title": "Personal Dashboard" },
  },
  {
    id: "cerebras",
    base: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY",
    textModels: async () => envList("CEREBRAS_MODEL", ["gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507"]),
    visionModels: async () => [],
    jsonMode: true,
  },
];

const DEFAULT_ORDER: ProviderId[] = ["gemini", "groq", "mistral", "openrouter", "cerebras"];

/** Proveedores con clave, en orden (AI_PROVIDERS="groq,gemini,…" cambia el orden). */
function providerOrder(): ProviderId[] {
  const custom = (process.env.AI_PROVIDERS ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is ProviderId => p in PROVIDER_LABELS);
  const order = [...new Set([...custom, ...DEFAULT_ORDER])];
  return order.filter((id) =>
    id === "gemini"
      ? Boolean(process.env.GEMINI_API_KEY)
      : Boolean(process.env[COMPAT.find((p) => p.id === id)!.keyEnv]),
  );
}

// Descanso tras un fallo de cuota o caída: no se vuelve a probar ese proveedor durante un rato
// (vive mientras la función de Vercel siga caliente; basta para no esperar timeouts seguidos).
const resting = new Map<string, number>();
const REST_MS = 90_000;

export class ProviderError extends Error {
  constructor(
    message: string,
    /** Cuota, saturación, caída o timeout: merece la pena probar otro modelo o proveedor. */
    readonly transient: boolean,
  ) {
    super(message);
  }
}

function isResting(key: string) {
  const until = resting.get(key);
  return until !== undefined && until > Date.now();
}

/** Una llamada a chat/completions; prueba los modelos del proveedor en orden si el anterior falla. */
async function compatRequest(
  provider: CompatProvider,
  body: Record<string, unknown>,
  vision: boolean,
): Promise<OpenAiMessage> {
  const models = (await (vision ? provider.visionModels() : provider.textModels())).filter(
    (m) => !isResting(`${provider.id}:${m}`),
  );
  if (!models.length) throw new ProviderError(`${PROVIDER_LABELS[provider.id]} sin modelos disponibles`, true);
  let last: ProviderError | null = null;
  for (const model of models) {
    let res: Response | null = null;
    try {
      res = await fetch(`${provider.base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env[provider.keyEnv]}`,
          ...provider.headers,
        },
        body: JSON.stringify({ ...body, model }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      res = null;
    }
    const label = `${PROVIDER_LABELS[provider.id]} (${model})`;
    if (!res || res.status === 429 || res.status >= 500 || res.status === 404 || res.status === 400) {
      // 400/404 suelen ser «modelo retirado» o «no admite esto»: se prueba el siguiente modelo
      const status = res ? res.status : "sin respuesta";
      if (!res || res.status === 429 || res.status >= 500) resting.set(`${provider.id}:${model}`, Date.now() + REST_MS);
      last = new ProviderError(`${label} ${status}`, true);
      continue;
    }
    if (!res.ok) throw new ProviderError(`${label} ${res.status}`, res.status === 402);
    const data = (await res.json().catch(() => null)) as { choices?: { message?: OpenAiMessage }[] } | null;
    const message = data?.choices?.[0]?.message;
    if (!message) {
      last = new ProviderError(`${label} sin respuesta`, true);
      continue;
    }
    return message;
  }
  throw last ?? new ProviderError(`${PROVIDER_LABELS[provider.id]} sin respuesta`, true);
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

/** Una foto, varias (en orden) o ninguna. */
type AiImages = AiImage | AiImage[] | undefined;
const imageList = (images: AiImages): AiImage[] => (images ? (Array.isArray(images) ? images : [images]) : []);

async function geminiJson(system: string, prompt: string, images?: AiImages): Promise<string> {
  const list = imageList(images);
  const parts: GeminiPart[] = [
    ...list.map((image) => ({ inline_data: { mime_type: image.mime, data: image.data } })),
    { text: prompt },
  ];
  const content = await geminiRequest({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: list.length ? 0.2 : 0.7 },
  });
  return geminiText(content);
}

function compatJson(provider: CompatProvider) {
  return async (system: string, prompt: string, images?: AiImages): Promise<string> => {
    const list = imageList(images);
    const message = await compatRequest(
      provider,
      {
        temperature: list.length ? 0.2 : 0.7,
        ...(provider.jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: `${system}\nResponde solo con un objeto JSON.` },
          {
            role: "user",
            content: list.length
              ? [
                  { type: "text", text: prompt },
                  ...list.map((image) => ({
                    type: "image_url",
                    image_url: { url: `data:${image.mime};base64,${image.data}` },
                  })),
                ]
              : prompt,
          },
        ],
      },
      list.length > 0,
    );
    if (typeof message.content !== "string" || !message.content) {
      throw new ProviderError(`${PROVIDER_LABELS[provider.id]} sin respuesta`, true);
    }
    return message.content;
  };
}

type JsonProvider = (system: string, prompt: string, images?: AiImages) => Promise<string>;

function jsonProviders(image: boolean): { id: ProviderId; run: JsonProvider }[] {
  return providerOrder().flatMap((id): { id: ProviderId; run: JsonProvider }[] => {
    if (id === "gemini") return [{ id, run: geminiJson }];
    const provider = COMPAT.find((p) => p.id === id)!;
    // Cerebras no ve fotos
    if (image && provider.id === "cerebras") return [];
    return [{ id, run: compatJson(provider) }];
  });
}

/** Ejecuta la cadena de proveedores: el primero que responda bien gana. */
async function withFallback<T>(
  providers: { id: ProviderId; run: () => Promise<T> }[],
  accept: (value: T) => boolean = () => true,
): Promise<T> {
  if (providers.length === 0) noProviders();
  // Los que están descansando van al final (por si son los únicos)
  const sorted = [...providers].sort((a, b) => Number(isResting(a.id)) - Number(isResting(b.id)));
  const errors: string[] = [];
  for (const provider of sorted) {
    try {
      const value = await provider.run();
      if (accept(value)) return value;
      errors.push(`${PROVIDER_LABELS[provider.id]}: respuesta vacía`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "error";
      // Solo descansa si el fallo es de cuota, saturación o caída (no por un JSON mal formado)
      const transient = e instanceof ProviderError ? e.transient : /\b(429|5\d\d)\b|a tiempo|timeout/i.test(message);
      if (transient) resting.set(provider.id, Date.now() + REST_MS);
      errors.push(
        message.startsWith(PROVIDER_LABELS[provider.id]) ? message : `${PROVIDER_LABELS[provider.id]}: ${message}`,
      );
    }
  }
  throw new Error(`La IA no respondió bien (${errors.join(" · ").slice(0, 300)}).`);
}

/**
 * Pide a la IA un JSON que cumpla el esquema; prueba los proveedores en orden hasta que uno acierte.
 * Admite una foto o varias (Gemini las recibe antes del texto, en orden).
 */
export async function askJson<T>(schema: z.ZodType<T>, system: string, prompt: string, images?: AiImages): Promise<T> {
  return withFallback(
    jsonProviders(imageList(images).length > 0).map(({ id, run }) => ({
      id,
      run: async () => schema.parse(extractJson(await run(system, prompt, images))),
    })),
  );
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
      generationConfig: { temperature: 0.3, thinkingConfig: { thinkingLevel: "low" } },
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

function compatChat(provider: CompatProvider) {
  return async (
    system: string,
    turns: ChatTurn[],
    tools: AiTool[],
    { maxRounds = MAX_TOOL_ROUNDS, onTool }: ChatOptions = {},
  ): Promise<ChatResult> => {
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
      const message = await compatRequest(
        provider,
        {
          temperature: 0.3,
          messages,
          ...(declarations.length ? { tools: declarations, tool_choice: round === maxRounds ? "none" : "auto" } : {}),
        },
        false,
      );
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
    throw new ProviderError(`${PROVIDER_LABELS[provider.id]} no terminó de responder`, false);
  };
}

/** Conversación con herramientas: prueba los proveedores en orden hasta que uno responda. */
export async function chatWithTools(
  system: string,
  turns: ChatTurn[],
  tools: AiTool[],
  options?: ChatOptions,
): Promise<ChatResult> {
  return withFallback(
    providerOrder().map((id) => ({
      id,
      run: () =>
        id === "gemini"
          ? geminiChat(system, turns, tools, options)
          : compatChat(COMPAT.find((p) => p.id === id)!)(system, turns, tools, options),
    })),
    (result) => Boolean(result.text),
  );
}
