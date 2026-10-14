import { NextResponse } from 'next/server';
import { BUILTIN_SOFTWARE_LOGOS } from '@/lib/softwareLogos';
import { detectAvatarImageType } from '@/lib/services/avatarUploadSecurity';

export async function GET(_request: Request, { params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (!Object.hasOwn(BUILTIN_SOFTWARE_LOGOS, brand)) return new NextResponse(null, { status:404 });
  const source = BUILTIN_SOFTWARE_LOGOS[brand as keyof typeof BUILTIN_SOFTWARE_LOGOS];
  try {
    const upstream = await fetch(source, { next:{ revalidate:86400 }, signal:AbortSignal.timeout(8000) });
    if (!upstream.ok) return new NextResponse(null, { status:404 });
    const reader = upstream.body?.getReader();
    if (!reader) return new NextResponse(null, { status:404 });
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 512 * 1024) { await reader.cancel(); return new NextResponse(null, { status:413 }); }
      chunks.push(value);
    }
    let bytes = Buffer.concat(chunks);
    if (brand === 'trinket') {
      const tag = bytes.toString('utf8').match(/<img\b[^>]*alt=["']Trinket["'][^>]*>/i)?.[0];
      const encoded = tag?.match(/src=["']data:image\/png;base64,([a-z0-9+/=]+)["']/i)?.[1];
      if (!encoded) return new NextResponse(null, { status:404 });
      bytes = Buffer.from(encoded, 'base64');
    }
    const image = ['image/png','image/jpeg','image/webp','image/gif'].find(type => detectAvatarImageType(type, bytes));
    const ico = bytes.length >= 6 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0 && bytes.readUInt16LE(4) > 0;
    const contentType = image || (ico ? 'image/x-icon' : null);
    if (!contentType) {
      return new NextResponse(null, { status:404 });
    }
    return new NextResponse(new Uint8Array(bytes), { headers:{
      'Content-Type':contentType, 'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options':'nosniff',
    } });
  } catch { return new NextResponse(null, { status:404 }); }
}
