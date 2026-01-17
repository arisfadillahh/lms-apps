import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fix for Baileys/Pino in Next.js
  serverExternalPackages: [
    'pino',
    'pino-pretty',
    '@whiskeysockets/baileys',
    'jimp',
    'sharp',
    'qrcode-terminal'
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
