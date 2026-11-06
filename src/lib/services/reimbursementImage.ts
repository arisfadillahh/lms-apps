import sharp from 'sharp';
import { detectAvatarImageType } from '@/lib/services/avatarUploadSecurity';
import { PayrollError } from '@/lib/payroll/model';

export const MAX_REIMBURSEMENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_REIMBURSEMENT_BODY_BYTES = MAX_REIMBURSEMENT_IMAGE_BYTES + 32 * 1024;

export async function readReimbursementForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) throw new PayrollError('Gunakan formulir dengan foto bukti.');
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_REIMBURSEMENT_BODY_BYTES) throw new PayrollError('Ukuran foto maksimal 5 MB.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PayrollError('Formulir belum lengkap.');
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REIMBURSEMENT_BODY_BYTES) { await reader.cancel(); throw new PayrollError('Ukuran foto maksimal 5 MB.', 413); }
    chunks.push(value);
  }
  try { return await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { 'Content-Type': contentType } }).formData(); }
  catch { throw new PayrollError('Formulir tidak valid. Pilih kembali foto bukti.'); }
}

export async function prepareReimbursementImage(file: File): Promise<Buffer> {
  if (!file.size || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new PayrollError('Foto bukti wajib berupa JPG, PNG, atau WebP.');
  if (file.size > MAX_REIMBURSEMENT_IMAGE_BYTES) throw new PayrollError('Ukuran foto maksimal 5 MB.', 413);
  const input = Buffer.from(await file.arrayBuffer());
  if (!detectAvatarImageType(file.type, input)) throw new PayrollError('Isi foto tidak sesuai dengan formatnya.');
  try {
    const decoder = sharp(input, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height || !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1) throw new Error('INVALID_IMAGE');
    // Re-encoding strips EXIF/location and never stores uploaded markup or filenames.
    const result = await decoder.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
    if (result.length > 3 * 1024 * 1024) throw new Error('TOO_LARGE');
    return result;
  } catch { throw new PayrollError('Foto tidak dapat dibaca. Gunakan foto JPG, PNG, atau WebP yang utuh, maksimal 20 megapiksel.'); }
}
