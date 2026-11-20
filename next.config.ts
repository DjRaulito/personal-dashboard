import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pantallas que se mudaron a Ajustes (refactor de noviembre de 2026)
  async redirects() {
    return [
      { source: "/finanzas/ajustes", destination: "/ajustes/finanzas", permanent: false },
      { source: "/finanzas/cuentas", destination: "/ajustes/finanzas/cuentas", permanent: false },
      { source: "/finanzas/categorias", destination: "/ajustes/finanzas/categorias", permanent: false },
      // Plan y Métricas se funden en Análisis
      { source: "/finanzas/plan", destination: "/finanzas/analisis", permanent: false },
      { source: "/finanzas/metricas", destination: "/finanzas/analisis", permanent: false },
      // Inmuebles es una tarea programada más (con su vista propia)
      { source: "/finanzas/inmuebles", destination: "/tareas/inmuebles", permanent: false },
      { source: "/finanzas/inmuebles/:path*", destination: "/tareas/inmuebles/:path*", permanent: false },
      // Armario v3: sin probador virtual
      { source: "/armario/probar", destination: "/armario", permanent: false },
      // Inversiones es una sección propia (estructura de noviembre de 2026)
      {
        source: "/finanzas/inversiones/activo/:id",
        destination: "/inversiones/posiciones?activo=:id",
        permanent: false,
      },
      { source: "/finanzas/inversiones/importar", destination: "/inversiones/importar", permanent: false },
      { source: "/finanzas/inversiones/:path*", destination: "/inversiones", permanent: false },
      { source: "/finanzas/inversiones", destination: "/inversiones", permanent: false },
      // Importar extractos pasa a Ajustes → Finanzas
      { source: "/finanzas/importar", destination: "/ajustes/finanzas/importar", permanent: false },
    ];
  },
  experimental: {
    // Importaciones de extractos de hasta 5000 movimientos y muestras de voz de hasta 3 MB (Vercel admite 4,5 MB)
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
