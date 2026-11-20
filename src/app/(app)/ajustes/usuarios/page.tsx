import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteManager, type InviteRow } from "@/components/settings-connections";
import { Tile, TileTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Usuarios · Ajustes" };
export const dynamic = "force-dynamic";

// Solo administradores: invitar emails de Google para que puedan entrar
export default async function UsersPage() {
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("is_admin");
  if (!admin) notFound();
  const { data } = await supabase.rpc("list_invites");

  return (
    <Tile>
      <TileTitle>Usuarios</TileTitle>
      <p className="text-muted mt-1 mb-5 text-sm">
        Invita a alguien con su email de Google y podrá entrar con su propia cuenta. Cada persona ve solo sus datos y
        pone sus propias claves de IA en Conexiones.
      </p>
      <InviteManager invites={(data ?? []) as InviteRow[]} />
    </Tile>
  );
}
