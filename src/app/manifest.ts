import type { MetadataRoute } from "next";

// Manifiesto para instalar la web como app (y base del icono de la APK en la fase 9)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal Dashboard",
    short_name: "Dashboard",
    description: "Finanzas, calendario, gimnasio, nutrición y más en un solo panel.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0e",
    theme_color: "#0b0b0e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
