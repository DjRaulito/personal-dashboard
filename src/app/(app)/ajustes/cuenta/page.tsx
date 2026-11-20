import type { Metadata } from "next";
import { buttonClass, Field, inputClass, Tile, TileTitle } from "@/components/ui";
import { CURRENCIES } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "../actions";

export const metadata: Metadata = { title: "Cuenta · Ajustes" };

export default async function AccountSettingsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: profile },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, currency, timezone").maybeSingle(),
  ]);

  return (
    <>
      {estado === "guardado" && (
        <p role="status" className="bg-surface-2 text-finance rounded-inner px-4 py-3 text-sm">
          Cambios guardados.
        </p>
      )}
      {estado === "error" && (
        <p role="alert" className="bg-surface-2 text-attention rounded-inner px-4 py-3 text-sm">
          No se pudieron guardar los cambios.
        </p>
      )}
      <Tile>
        <TileTitle>Perfil</TileTitle>
        {user?.email && <p className="text-muted mt-1 text-sm">{user.email}</p>}
        <form action={updateProfile} className="mt-5 flex max-w-md flex-col gap-4">
          <Field label="Nombre">
            <input
              name="display_name"
              defaultValue={profile?.display_name ?? ""}
              maxLength={80}
              autoComplete="name"
              className={inputClass}
            />
          </Field>
          <Field label="Moneda">
            <select name="currency" defaultValue={profile?.currency ?? "EUR"} className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-muted text-sm">Zona horaria: {profile?.timezone ?? "Europe/Madrid"}</p>
          <button type="submit" className={`${buttonClass.primary} self-start`}>
            Guardar
          </button>
        </form>
      </Tile>
      <Tile>
        <TileTitle>Sesión</TileTitle>
        <form action="/auth/signout" method="post" className="mt-4">
          <button type="submit" className={buttonClass.secondary}>
            Cerrar sesión
          </button>
        </form>
      </Tile>
    </>
  );
}
