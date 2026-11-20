// Proveedores de IA con capa gratuita y dónde sacar cada clave (puro, sin servidor).

export const AI_PROVIDERS = ["gemini", "groq", "mistral", "openrouter", "cerebras"] as const;
export type ProviderId = (typeof AI_PROVIDERS)[number];

export const PROVIDER_INFO: Record<ProviderId, { label: string; env: string; url: string }> = {
  gemini: { label: "Gemini", env: "GEMINI_API_KEY", url: "https://aistudio.google.com/apikey" },
  groq: { label: "Groq", env: "GROQ_API_KEY", url: "https://console.groq.com/keys" },
  mistral: { label: "Mistral", env: "MISTRAL_API_KEY", url: "https://console.mistral.ai/api-keys" },
  openrouter: { label: "OpenRouter", env: "OPENROUTER_API_KEY", url: "https://openrouter.ai/settings/keys" },
  cerebras: { label: "Cerebras", env: "CEREBRAS_API_KEY", url: "https://cloud.cerebras.ai" },
};

export type AiKeys = Partial<Record<ProviderId, string>>;

/** Últimos 4 caracteres para reconocer una clave sin enseñarla. */
export const keyHint = (key: string) => key.trim().slice(-4);
