import type { Metadata, Viewport } from "next";
// Fuentes autoalojadas (sin peticiones a Google Fonts en build ni en runtime)
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/onest/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Dashboard",
  description: "Finanzas, calendario, contenido, gimnasio, nutrición y agentes en un solo panel.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
