import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pantallas que se mudaron a Ajustes (refactor de noviembre de 2026)
  async redirects() {
    return [
      { source: "/finanzas/ajustes", destination: "/ajustes/finanzas", permanent: false },
      { source: "/finanzas/cuentas", destination: "/ajustes/finanzas/cuentas", permanent: false },
      { source: "/finanzas/categorias", destination: "/ajustes/finanzas/categorias", permanent: false },
    ];
  },
  experimental: {
    // Importaciones de extractos de hasta 5000 movimientos y muestras de voz de hasta 3 MB (Vercel admite 4,5 MB)
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
