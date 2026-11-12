import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getInvoiceById } from '@/lib/dao/invoicesDao';
import { holidayBatches, holidayLevels, holidayPlatformFee, holidaySessionMinutes, holidayStartMinutes } from '@/lib/holidayClass';
import { normalizeIndonesianPhone } from '@/lib/phoneNumbers';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const personName = z.string().trim().min(2).max(100).regex(/^[\p{L}\p{M}\p{N} .’'-]+$/u);
export const holidayRegistrationSchema = z.object({
  id: z.string().uuid(),
  parentName: personName,
  studentName: personName,
  phone: z.string().trim().max(24).regex(/^\+?[\d .()-]+$/).transform(normalizeIndonesianPhone).pipe(z.string().regex(/^628\d{7,12}$/)),
  email: z.union([z.string().trim().email().max(160).transform(value => value.toLowerCase()), z.literal('')]).default(''),
  schoolGrade: z.number().int().min(1).max(12),
  selections: z.array(z.object({ program: z.number().int().min(0).max(3), batch: z.number().int().min(0).max(6) })).min(1).max(3),
  platform: z.enum(['none', 'own', 'clevio']),
  consent: z.literal(true),
});

export class HolidayRegistrationError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

type HolidayInput = z.infer<typeof holidayRegistrationSchema>;

export function prepareHolidayRegistration(input: HolidayInput, now = new Date()) {
  const level = holidayLevels.find(entry => input.schoolGrade >= entry.minGrade && input.schoolGrade <= entry.maxGrade)!;
  if (![1, 3].includes(input.selections.length) || new Set(input.selections.map(s => s.program)).size !== input.selections.length) {
    throw new HolidayRegistrationError('Pilih satu program, atau tiga program berbeda untuk bundling.');
  }
  const selections = [...input.selections].sort((a, b) => a.program - b.program).map(choice => {
    const program = level.programs[choice.program];
    const batch = holidayBatches[choice.batch];
    if (!program || !batch) throw new HolidayRegistrationError('Program atau batch tidak tersedia untuk jenjang ini.');
    const time = program[choice.batch + 1];
    if (new Date(batch.start + 'T' + time.replace('.', ':') + ':00+07:00') <= now) {
      throw new HolidayRegistrationError('Salah satu batch sudah dimulai. Pilih batch berikutnya.');
    }
    return { name: program[0], batch: batch.label, start: batch.start, end: batch.end, time };
  });
  for (const [index, current] of selections.entries()) {
    const overlaps = selections.slice(0, index).some(other =>
      current.start <= other.end && other.start <= current.end
      && Math.abs(holidayStartMinutes(current.time) - holidayStartMinutes(other.time)) < holidaySessionMinutes);
    if (overlaps) throw new HolidayRegistrationError('Ada jadwal yang bentrok. Pilih jam atau batch lain.');
  }

  const hasGodot = selections.some(choice => choice.name === holidayLevels[2].programs[0][0]);
  if (hasGodot === (input.platform === 'none')) {
    throw new HolidayRegistrationError(hasGodot ? 'Pilih cara menyiapkan platform Open Code untuk Godot.' : 'Platform Open Code khusus untuk program Godot.');
  }
  const packagePrice = selections.length === 3 ? level.bundle : level.price;
  const platformFee = input.platform === 'clevio' ? holidayPlatformFee : 0;
  const items = selections.map<{ name: string; description: string; basePrice: number; discount: number; total: number }>((selection, index) => {
    const total = Math.floor(packagePrice / selections.length) + Number(index < packagePrice % selections.length);
    return {
      name: selection.name,
      description: `${selection.batch} · ${selection.time} WIB · ${holidaySessionMinutes} menit/sesi`,
      basePrice: level.price,
      discount: level.price - total,
      total,
    };
  });
  if (platformFee) items.push({
    name: 'Platform Open Code',
    description: 'Akses platform untuk kelas Vibe Coding Godot + MCP',
    basePrice: platformFee,
    discount: 0,
    total: platformFee,
  });
  return {
    parentName: input.parentName,
    studentName: input.studentName,
    email: input.email,
    phone: input.phone,
    schoolGrade: input.schoolGrade,
    platform: input.platform,
    level: level.name,
    selections,
    total: packagePrice + platformFee,
    startDate: selections.map(s => s.start).sort()[0],
    endDate: selections.map(s => s.end).sort().at(-1)!,
    items,
  };
}

export async function createHolidayRegistration(input: HolidayInput) {
  const db = getSupabaseAdmin();
  // A retry must resolve to the same invoice even if the catalog or dates change.
  const hash = createHash('sha256').update(JSON.stringify({
    parentName: input.parentName, studentName: input.studentName, phone: input.phone, email: input.email,
    schoolGrade: input.schoolGrade, platform: input.platform,
    selections: [...input.selections].sort((a, b) => a.program - b.program),
  })).digest('hex');
  const { data: existing, error: lookupError } = await db.from('holiday_class_registrations' as never)
    .select('invoice_id,request_hash').eq('id', input.id).maybeSingle();
  if (lookupError) throw new Error('Holiday registration lookup failed');
  const previous = existing as { invoice_id: string; request_hash: string } | null;
  if (previous) {
    if (previous.request_hash !== hash) throw new HolidayRegistrationError('Data berbeda dari pendaftaran sebelumnya. Mulai pendaftaran baru.', 409);
    return requireInvoice(previous.invoice_id);
  }
  const details = prepareHolidayRegistration(input);
  const { data: invoiceId, error } = await db.rpc('create_holiday_class_registration' as never, {
    p_id: input.id, p_hash: hash, p_details: details,
  } as never);
  if (error?.message === 'HOLIDAY_REQUEST_CHANGED') throw new HolidayRegistrationError('Data berbeda dari pendaftaran sebelumnya. Mulai pendaftaran baru.', 409);
  if (error || typeof invoiceId !== 'string') throw new Error('Holiday registration transaction failed');
  return requireInvoice(invoiceId);
}

async function requireInvoice(id: string) {
  const invoice = await getInvoiceById(id);
  if (!invoice) throw new Error('Holiday invoice lookup failed');
  return invoice;
}
