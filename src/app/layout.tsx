import type { Metadata, Viewport } from "next";
// Fuentes autoalojadas (sin peticiones a Google Fonts en build ni en runtime)
import "@fontsource-variable/inter/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Dashboard",
  description: "Finanzas, nutrición, armario, cerebro y tareas en un solo panel.",
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
