import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/page-header";
import { getGoogleConfig } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/profile";
import { updateProfile } from "./actions";

export const metadata: Metadata = { title: "Ajustes · Personal Dashboard" };

const inputClass =
  "bg-surface-2 border-border-strong rounded-inner focus-visible:outline-content w-full border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: profile },
    { data: google },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("display_name, currency, timezone").maybeSingle(),
    supabase.from("integrations").select("account_email, updated_at").eq("provider", "google").maybeSingle(),
  ]);

  const googleStatus = !getGoogleConfig()
    ? "Sin configurar en el servidor"
    : google
      ? `Conectado${google.account_email ? ` · ${google.account_email}` : ""}`
      : "Sin conectar: vuelve a entrar con Google";

  return (
    <PageShell>
      <PageHeader title="Ajustes" subtitle={user?.email ?? undefined} />

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

      <div className="grid gap-3.5 md:grid-cols-2">
        <section aria-labelledby="perfil" className="rounded-tile border-border bg-surface border p-6">
          <h2 id="perfil" className="font-semibold">
            Perfil
          </h2>
          <form action={updateProfile} className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Nombre</span>
              <input
                name="display_name"
                defaultValue={profile?.display_name ?? ""}
                maxLength={80}
                autoComplete="name"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted">Moneda</span>
              <select name="currency" defaultValue={profile?.currency ?? "EUR"} className={inputClass}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-muted text-sm">Zona horaria: {profile?.timezone ?? "Europe/Madrid"}</p>
            <button
              type="submit"
              className="bg-finance text-ink focus-visible:outline-text self-start rounded-full px-5 py-2.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Guardar
            </button>
          </form>
        </section>

        <div className="flex flex-col gap-3.5">
          <section aria-labelledby="conexiones" className="rounded-tile border-border bg-surface border p-6">
            <h2 id="conexiones" className="font-semibold">
              Conexiones
            </h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div className="bg-surface-2 rounded-inner flex items-center justify-between gap-3 px-4 py-3">
                <dt>Google Calendar</dt>
                <dd className="text-muted truncate">{googleStatus}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="sesion" className="rounded-tile border-border bg-surface border p-6">
            <h2 id="sesion" className="font-semibold">
              Sesión
            </h2>
            <form action="/auth/signout" method="post" className="mt-4">
              <button
                type="submit"
                className="border-border-strong hover:bg-surface-2 rounded-full border px-5 py-2.5 font-medium transition-colors duration-200"
              >
                Cerrar sesión
              </button>
            </form>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
