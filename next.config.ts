import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Importaciones de extractos de hasta 5000 movimientos y muestras de voz de hasta 3 MB (Vercel admite 4,5 MB)
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
