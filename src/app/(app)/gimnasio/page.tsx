import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Gimnasio · Personal Dashboard" };

export default function Page() {
  return <ComingSoon moduleKey="gimnasio" />;
}
