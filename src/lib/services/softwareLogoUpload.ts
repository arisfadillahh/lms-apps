import sharp from 'sharp';
import { detectAvatarImageType } from '@/lib/services/avatarUploadSecurity';

export const MAX_SOFTWARE_LOGO_BYTES = 1024 * 1024;
export const MAX_SOFTWARE_LOGO_REQUEST_BYTES = MAX_SOFTWARE_LOGO_BYTES + 32 * 1024;

export async function readSoftwareLogoForm(request: Request): Promise<FormData> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) throw new Error('INVALID_FORM');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_FORM');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_SOFTWARE_LOGO_REQUEST_BYTES) { await reader.cancel(); throw new Error('TOO_LARGE'); }
    chunks.push(value);
  }
  return new Response(new Uint8Array(Buffer.concat(chunks)), { headers:{ 'Content-Type':request.headers.get('content-type')! } }).formData();
}

export async function validateSoftwareLogoImage(file: File) {
  if (file.size > MAX_SOFTWARE_LOGO_BYTES) throw new Error('TOO_LARGE');
  if (!file.size) throw new Error('INVALID_IMAGE');
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('INVALID_IMAGE');
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = detectAvatarImageType(file.type, buffer);
  if (!type) throw new Error('INVALID_IMAGE');
  try {
    const decoder = sharp(buffer, { limitInputPixels:4_000_000 });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height || !['png','jpeg','webp'].includes(metadata.format || '')) throw new Error('INVALID_IMAGE');
    await decoder.stats(); // Decode pixels as well as the header; truncated images must not be stored.
  } catch { throw new Error('INVALID_IMAGE'); }
  return { buffer, contentType:type.contentType, extension:type.extension };
}
