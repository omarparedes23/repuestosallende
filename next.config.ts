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
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
