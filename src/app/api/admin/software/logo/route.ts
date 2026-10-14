import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerAuthSession } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rateLimit';
import { uploadPortfolioScreenshot } from '@/lib/storage';
import { readSoftwareLogoForm, validateSoftwareLogoImage } from '@/lib/services/softwareLogoUpload';

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session) return NextResponse.json({ error:'Silakan login.' }, { status:401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error:'Hanya admin yang dapat mengunggah logo software.' }, { status:403 });
  if (!await consumeRateLimit({ request, scope:'software-logo-upload', actorId:session.user.id, maxRequests:30, windowSeconds:3600 })) {
    return NextResponse.json({ error:'Terlalu banyak upload. Coba lagi nanti.' }, { status:429 });
  }
  try {
    const form = await readSoftwareLogoForm(request);
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error:'Pilih gambar logo.' }, { status:400 });
    const image = await validateSoftwareLogoImage(file);
    const iconUrl = await uploadPortfolioScreenshot(`software-logos/${randomUUID()}${image.extension}`, image.buffer, image.contentType);
    return NextResponse.json({ iconUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'TOO_LARGE') return NextResponse.json({ error:'Logo maksimal 1 MB.' }, { status:413 });
    if (message === 'INVALID_IMAGE' || message === 'INVALID_FORM' || error instanceof TypeError) {
      return NextResponse.json({ error:'Gunakan gambar PNG, JPG, atau WebP yang valid.' }, { status:400 });
    }
    return NextResponse.json({ error:'Logo belum berhasil diunggah. Silakan coba lagi.' }, { status:500 });
  }
}
