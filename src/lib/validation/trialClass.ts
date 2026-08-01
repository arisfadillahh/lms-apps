import { z } from 'zod';
import { isValidIndonesianMobile } from '@/lib/phoneNumbers';

export { normalizeIndonesianPhone } from '@/lib/phoneNumbers';

export const TRIAL_CLASS_MODES = ['ONLINE', 'OFFLINE'] as const;
export const OFFLINE_TRIAL_SCHEDULE = 'Setiap Sabtu';
export const OFFLINE_TRIAL_ADDRESS = 'Bukit Golf Riverside 1, Blok A7 No. 25, Kab. Bogor';

export const trialClassSchema = z.object({
  studentName: z.string().trim().min(2, 'Nama anak wajib diisi.').max(120, 'Nama anak terlalu panjang.'),
  studentGrade: z.string().trim().min(1, 'Kelas wajib diisi.').max(50, 'Kelas terlalu panjang.'),
  schoolName: z.string().trim().min(2, 'Nama sekolah wajib diisi.').max(160, 'Nama sekolah terlalu panjang.'),
  parentName: z.string().trim().min(2, 'Nama orang tua wajib diisi.').max(120, 'Nama orang tua terlalu panjang.'),
  phone: z
    .string()
    .trim()
    .min(8, 'Nomor telepon wajib diisi.')
    .max(24, 'Nomor telepon terlalu panjang.')
    .refine(isValidIndonesianMobile, {
      message: 'Gunakan nomor WhatsApp aktif, contoh 081234567890.',
    }),
  email: z.string().trim().email('Format email belum benar.').max(254, 'Email terlalu panjang.'),
  trialMode: z.enum(TRIAL_CLASS_MODES, { error: 'Pilih jenis trial.' }),
  notes: z.string().trim().max(1000, 'Catatan maksimal 1.000 karakter.').optional(),
  website: z.string().max(0).optional(),
});

export type TrialClassFormValues = z.infer<typeof trialClassSchema>;
