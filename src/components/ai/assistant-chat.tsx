"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { askAssistant } from "@/app/(app)/ia/actions";
import { buttonClass, inputClass } from "@/components/ui";
import { Markdown } from "./markdown";

interface Message {
  role: "user" | "assistant";
  text: string;
  error?: boolean;
}

const STORAGE_KEY = "ia-chat-v1";

const SUGGESTIONS = [
  "¿Cuánto he gastado este mes y en qué?",
  "¿Cómo voy con la dieta esta semana?",
  "¿Cuántas series de pecho hice la semana pasada?",
  "¿Cómo ha evolucionado mi press banca?",
  "¿Qué pagos tengo pendientes este mes?",
  "¿Qué tengo en la agenda esta semana?",
];

function loadHistory(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Message[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AssistantChat({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // El historial vive en la pestaña: se pierde al cerrarla (no se guarda en la base de datos)
  useEffect(() => setMessages(loadHistory()), []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // sin almacenamiento: el chat funciona igual
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    const history = [...messages.filter((m) => !m.error), { role: "user" as const, text: question }];
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setDraft("");
    startTransition(async () => {
      const res = await askAssistant(history.map(({ role, text }) => ({ role, text })));
      setMessages((prev) => [
        ...prev,
        res.ok ? { role: "assistant", text: res.data.text } : { role: "assistant", text: res.message, error: true },
      ]);
      inputRef.current?.focus();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!configured && (
        <p role="alert" className="bg-surface-2 rounded-inner text-attention px-3.5 py-2.5 text-sm">
          Falta configurar la IA: añade en Vercel una clave gratuita (GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY u
          OPENROUTER_API_KEY).
        </p>
      )}

      {messages.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted text-sm">
            Pregunta lo que quieras sobre tus finanzas, entrenos, dieta o agenda. Responde con tus datos reales.
          </p>
          <ul className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => send(s)}
                  disabled={pending || !configured}
                  className="border-border-strong hover:bg-surface-2 rounded-full border px-3.5 py-1.5 text-left text-sm transition-colors duration-150 active:scale-[0.97] disabled:opacity-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="flex flex-col gap-3" aria-live="polite">
          {messages.map((m, i) => (
            <li
              key={i}
              className={clsx(
                "rounded-tile max-w-[90%] px-4 py-3 text-sm",
                m.role === "user" ? "bg-content text-ink self-end" : "bg-surface border-border self-start border",
                m.error && "text-attention",
              )}
            >
              <span className="sr-only">{m.role === "user" ? "Tú: " : "Asistente: "}</span>
              {m.role === "assistant" && !m.error ? (
                <Markdown text={m.text} />
              ) : (
                <p className="whitespace-pre-wrap">{m.text}</p>
              )}
            </li>
          ))}
          {pending && (
            <li className="bg-surface border-border text-muted rounded-tile self-start border px-4 py-3 text-sm">
              <span className="animate-pulse motion-reduce:animate-none">Mirando tus datos…</span>
            </li>
          )}
        </ol>
      )}
      <div ref={endRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="bg-bg/95 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex items-end gap-2 py-2 backdrop-blur md:bottom-0"
      >
        <label className="sr-only" htmlFor="ia-question">
          Pregunta
        </label>
        <textarea
          id="ia-question"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Pregunta algo…"
          disabled={!configured}
          className={clsx(inputClass, "max-h-40 min-h-11 resize-none")}
        />
        <button type="submit" disabled={pending || !draft.trim() || !configured} className={buttonClass.primary}>
          Enviar
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            disabled={pending}
            className={buttonClass.secondary}
            aria-label="Empezar una conversación nueva"
          >
            Nueva
          </button>
        )}
      </form>
    </div>
  );
}
