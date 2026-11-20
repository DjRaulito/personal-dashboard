"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { profileSchema } from "@/lib/profile";
import { confirmWord, MODULE_TABLES, type DataModule } from "@/lib/settings/data";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const parsed = profileSchema.safeParse({
    display_name: formData.get("display_name") ?? "",
    currency: formData.get("currency"),
  });
  if (!parsed.success) redirect("/ajustes/cuenta?estado=error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", user.id);
  if (error) redirect("/ajustes/cuenta?estado=error");

  revalidatePath("/", "layout");
  redirect("/ajustes/cuenta?estado=guardado");
}

const deleteInput = z.object({
  module: z.enum(Object.keys(MODULE_TABLES) as [DataModule, ...DataModule[]]),
  confirm: z.string(),
});

/** Borra todos los datos de un módulo. Hay que escribir «borrar <módulo>» para confirmar. */
export async function deleteModuleData(input: unknown): Promise<{ ok: boolean; message: string }> {
  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Petición no válida." };
  const { module, confirm } = parsed.data;
  if (confirm.trim().toLowerCase() !== confirmWord(module)) {
    return { ok: false, message: `Escribe «${confirmWord(module)}» para confirmar.` };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Las fotos del armario están en Storage: se borran antes que sus filas
  if (module === "armario") {
    const { data: garments } = await supabase.from("wardrobe_garments").select("image_path");
    const paths = (garments ?? []).map((g) => g.image_path);
    for (const folder of [`${user.id}/me`, `${user.id}/tryon`]) {
      const { data: files } = await supabase.storage.from("wardrobe").list(folder, { limit: 1000 });
      paths.push(...(files ?? []).map((f) => `${folder}/${f.name}`));
    }
    for (let i = 0; i < paths.length; i += 100) await supabase.storage.from("wardrobe").remove(paths.slice(i, i + 100));
  }

  for (const table of MODULE_TABLES[module].tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", user.id);
    if (error) {
      revalidatePath("/", "layout");
      return { ok: false, message: `Se paró al borrar ${table}. Lo anterior ya se ha borrado.` };
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `Datos de ${MODULE_TABLES[module].label} borrados.` };
}
