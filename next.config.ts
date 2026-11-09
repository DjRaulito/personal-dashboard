import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Importaciones de extractos de hasta 5000 movimientos
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
