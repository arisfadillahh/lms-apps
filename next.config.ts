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
  // Dynamic LMS pages must refetch on navigation so coach/admin dashboards
  // show newly assigned trials, payments, and evaluation tasks immediately.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;

