import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GarmentManager } from "@/components/wardrobe/garment-manager";
import { aiConfigured } from "@/lib/ai/llm";
import { createClient } from "@/lib/supabase/server";
import { getGarments } from "@/lib/wardrobe/server";

export const metadata: Metadata = { title: "Prendas · Armario" };
export const maxDuration = 60;

export default async function GarmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <GarmentManager garments={await getGarments()} userId={user.id} aiReady={aiConfigured()} />;
}
