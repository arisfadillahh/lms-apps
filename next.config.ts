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
  // Keep dynamic pages in the client-side router cache for 5 minutes
  // so navigating back to dashboard doesn't trigger a full re-fetch
  experimental: {
    staleTimes: {
      dynamic: 300, // seconds - cached for 5 min after first load
    },
  },
};

export default nextConfig;

