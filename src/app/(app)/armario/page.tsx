import type { Metadata } from "next";
import { WardrobeToday } from "@/components/wardrobe/wardrobe-today";
import { getCalendarEvents } from "@/lib/calendar/server";
import { daysFromToday } from "@/lib/calendar/range";
import { aiConfigured } from "@/lib/ai/llm";
import { getGarments, getTodayWeather, getWardrobeSettings } from "@/lib/wardrobe/server";

export const metadata: Metadata = { title: "Armario" };
// La IA del estilista puede tardar si un proveedor falla y se pasa al siguiente
export const maxDuration = 60;

export default async function WardrobeTodayPage() {
  const now = new Date();
  const [garments, settings, agenda] = await Promise.all([
    getGarments(),
    getWardrobeSettings(),
    getCalendarEvents(daysFromToday(now, 1)),
  ]);
  const weather = await getTodayWeather(settings);
  // El plan del día sale del primer evento que aún no ha terminado (si lo hay)
  const event =
    agenda.status === "ok" ? (agenda.events.find((e) => !e.allDay && e.end > now) ?? agenda.events[0]) : undefined;
  return (
    <WardrobeToday
      garments={garments}
      weather={weather}
      city={settings.city}
      planHint={event?.title ?? ""}
      aiReady={await aiConfigured()}
    />
  );
}
