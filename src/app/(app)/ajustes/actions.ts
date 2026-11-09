"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profileSchema } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const parsed = profileSchema.safeParse({
    display_name: formData.get("display_name") ?? "",
    currency: formData.get("currency"),
  });
  if (!parsed.success) redirect("/ajustes?estado=error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", user.id);
  if (error) redirect("/ajustes?estado=error");

  revalidatePath("/", "layout");
  redirect("/ajustes?estado=guardado");
}
