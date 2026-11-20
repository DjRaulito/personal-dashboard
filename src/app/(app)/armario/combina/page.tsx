import type { Metadata } from "next";
import { CombineStudio } from "@/components/wardrobe/combine-studio";
import { aiConfigured } from "@/lib/ai/llm";
import { getGarments } from "@/lib/wardrobe/server";

export const metadata: Metadata = { title: "¿Combina? · Armario" };
export const maxDuration = 60;

export default async function CombinePage() {
  return <CombineStudio garments={await getGarments()} aiReady={aiConfigured()} />;
}
