import { describe, expect, it, vi } from 'vitest';
import { holidayRegistrationSchema, prepareHolidayRegistration } from '@/lib/services/holidayClassRegistration';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceById: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ getSupabaseAdmin: vi.fn() }));

const now = new Date('2026-11-12T08:00:00+07:00');
const registration = {
  id: '361d9403-66be-4609-bdc1-707f5c57324a',
  parentName: 'Wali Demo',
  studentName: 'Anak Demo',
  phone: '081234567890',
  email: 'wali@example.test',
  schoolGrade: 9,
  selections: [{ program: 0, batch: 0 }],
  platform: 'own',
  consent: true,
};

const prepare = (override: Partial<typeof registration> = {}, date = now) =>
  prepareHolidayRegistration(holidayRegistrationSchema.parse({ ...registration, ...override }), date);

describe('Holiday Class checkout catalog', () => {
  it('accepts registrations without requesting an email address', () => {
    const withoutEmail: Partial<typeof registration> = { ...registration };
    delete withoutEmail.email;
    const parsed = holidayRegistrationSchema.parse(withoutEmail);
    const prepared = prepareHolidayRegistration(parsed, now);
    expect(prepared.email).toBe('');
    expect(prepared.total).toBe(500000);
    expect(holidayRegistrationSchema.parse({ ...registration, email: '' }).email).toBe('');
  });

  it('charges Rp500k for Godot with self-provided Open Code or Rp700k with Clevio access', () => {
    expect(prepare().total).toBe(500000);
    const withPlatform = prepare({ platform: 'clevio' });
    expect(withPlatform.total).toBe(700000);
    expect(withPlatform.items.map(item => item.total)).toEqual([500000, 200000]);
    expect(withPlatform.phone).toBe('6281234567890');
  });

  it('applies the platform fee once to the bundle and allocates exact invoice line totals', () => {
    const quote = prepare({
      selections: [{ program: 2, batch: 2 }, { program: 0, batch: 0 }, { program: 1, batch: 1 }],
      platform: 'clevio',
    });
    expect(quote.total).toBe(1500000);
    expect(quote.items.reduce((sum, item) => sum + item.total, 0)).toBe(quote.total);
    expect(quote.startDate).toBe('2026-12-14');
    expect(quote.endDate).toBe('2026-12-23');
  });

  it('requires three distinct programs for bundling and rejects overlapping 90-minute slots', () => {
    expect(() => prepare({ selections: [{ program: 0, batch: 0 }, { program: 0, batch: 1 }, { program: 2, batch: 2 }] }))
      .toThrow(/berbeda/);
    expect(() => prepare({ selections: [{ program: 0, batch: 0 }, { program: 1, batch: 0 }, { program: 2, batch: 2 }] }))
      .toThrow(/bentrok/);
  });

  it('requires Open Code only for Godot and rejects a batch that already started', () => {
    expect(() => prepare({ platform: 'none' })).toThrow(/Open Code/);
    expect(() => prepare({ selections: [{ program: 1, batch: 0 }] })).toThrow(/khusus/);
    expect(() => prepare({}, new Date('2026-12-14T09:01:00+07:00'))).toThrow(/sudah dimulai/);
  });
});
