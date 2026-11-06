export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export type ReimbursementFields = { title: string; amount: string; photo: Pick<File, 'type' | 'size'> | null };
export type ReimbursementErrors = Partial<Record<keyof ReimbursementFields, string>>;

export function validateReimbursement(fields: ReimbursementFields): ReimbursementErrors {
  const errors: ReimbursementErrors = {};
  if (fields.title.trim().length < 3 || fields.title.trim().length > 120) errors.title = 'Isi nama pengeluaran sepanjang 3–120 karakter.';
  const amount = Number(fields.amount);
  if (!/^\d+$/.test(fields.amount) || !Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000) {
    errors.amount = 'Isi nominal rupiah utuh, antara Rp1 dan Rp1.000.000.000, tanpa titik atau koma.';
  }
  if (!fields.photo) errors.photo = 'Tambahkan foto nota atau bukti pembayaran.';
  else if (!PHOTO_TYPES.includes(fields.photo.type)) errors.photo = 'Gunakan foto JPG, PNG, atau WebP.';
  else if (fields.photo.size < 1 || fields.photo.size > MAX_PHOTO_BYTES) errors.photo = 'Ukuran foto harus lebih dari 0 dan maksimal 5 MB.';
  return errors;
}

export function submissionsOpen(canSubmit: boolean, deadline: string, now: number): boolean {
  const end = Date.parse(deadline);
  return canSubmit && Number.isFinite(end) && now < end;
}
