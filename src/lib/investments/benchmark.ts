import "server-only";
import { unstable_cache } from "next/cache";
import { addDays } from "./engine";
import { dailyCloses } from "./refresh";

/** MSCI World en euros (ETF iShares Core MSCI World, Ámsterdam). */
export const BENCHMARK = { symbol: "IWDA.AS", name: "MSCI World" } as const;

/** Cierres del índice de los últimos 6 años, guardados 6 horas. */
export const benchmarkCloses = unstable_cache(
  async (today: string) => {
    try {
      return (await dailyCloses(BENCHMARK.symbol, addDays(today, -6 * 366), today)).points;
    } catch {
      return [];
    }
  },
  ["benchmark-closes"],
  { revalidate: 6 * 3600 },
);
