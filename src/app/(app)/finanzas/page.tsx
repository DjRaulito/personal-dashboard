import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Finanzas · Personal Dashboard" };

export default function Page() {
  return <ComingSoon moduleKey="finanzas" />;
}
