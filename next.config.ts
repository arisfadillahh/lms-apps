import type { NextConfig } from 'next';
import { buildContentSecurityPolicy } from './src/lib/security/contentSecurityPolicy';

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: buildContentSecurityPolicy() },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }];
  },
};

export default nextConfig;
