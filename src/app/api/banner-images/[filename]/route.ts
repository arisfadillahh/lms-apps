import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BANNERS_DIR } from '@/lib/bannerStorage';
import { detectAvatarImageType } from '@/lib/services/avatarUploadSecurity';

export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]+\.(png|jpe?g|webp)$/i.test(filename)) return new Response(null, { status: 404 });
  try {
    const buffer = await fs.readFile(path.join(BANNERS_DIR, filename));
    const mime = /\.png$/i.test(filename) ? 'image/png' : /\.webp$/i.test(filename) ? 'image/webp' : 'image/jpeg';
    if (!detectAvatarImageType(mime, buffer)) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(buffer), { headers: {
      'Content-Type': mime, 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
    } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
