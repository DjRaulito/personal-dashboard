import type { Metadata } from "next";
import { AssistantChat } from "@/components/ai/assistant-chat";
import { aiConfigured } from "@/lib/ai/llm";

export const metadata: Metadata = { title: "Asistente" };
// El asistente puede encadenar varias consultas: más margen que el límite por defecto
export const maxDuration = 60;
// La comprobación de la clave de IA se hace en cada visita, no al compilar
export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return <AssistantChat configured={aiConfigured()} />;
}
