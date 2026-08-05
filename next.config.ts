import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite probar `next dev` desde el celular vía IP local (192.168.1.112).
  // Sin esto, Next bloquea las peticiones cross-origin a sus recursos de dev
  // (HMR/RSC) por protección contra DNS rebinding, y la página queda a medio
  // hidratar en cualquier origen que no sea localhost.
  allowedDevOrigins: ['192.168.1.112'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev',
      },
    ],
    // 1 año: las URLs de R2 llevan ?v=timestamp para cache-busting (src/lib/r2.ts),
    // así que no hace falta el default de 60s que gasta cuota de transformaciones en cada re-fetch.
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 828, 1200, 1920],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
