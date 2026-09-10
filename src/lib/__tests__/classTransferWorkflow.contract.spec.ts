import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('coder class transfer workflow contract', () => {
  it('moves enrollment and payment state in one database function', () => {
    const migration = read('supabase/migrations/20260910090000_enrollment_transfer_lifecycle.sql');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.transfer_coder_enrollment');
    expect(migration).toContain("exit_reason = 'TRANSFERRED'");
    expect(migration).toContain("ON CONFLICT (class_id, coder_id) DO UPDATE");
    expect(migration).toContain('UPDATE public.coder_payment_periods');
    expect(migration).toContain('INSERT INTO public.enrollment_transfers');
  });

  it('requires report eligibility and coder reflection before generation or submit', () => {
    const generator = read('src/lib/services/aiReports.ts');
    const submit = read('src/app/api/coach/reports/[id]/publish/route.ts');
    expect(generator).toContain('isEnrollmentActiveForSession(enrollment, lastBlockSession.date_time)');
    expect(generator).toContain('reflectedCoderIds.has(coderId)');
    expect(submit).toContain('Coder tidak terdaftar di kelas ini pada periode rapor');
    expect(submit).toContain('Refleksi evaluasi coder belum selesai');
  });

  it('revalidates WhatsApp and PWA reminders against live operational state', () => {
    const whatsapp = read('src/lib/services/classReminderScheduler.ts');
    const pwa = read('src/lib/services/roleSessionReminders.ts');
    expect(whatsapp).toContain('revalidateParentReminderRecipients');
    expect(whatsapp).toContain('isClassActiveForOperationalMessages');
    expect(whatsapp).toContain('coder.is_active !== true');
    expect(whatsapp).toContain('isCoachSessionReminderEligible');
    expect(pwa).toContain('isStillEligible: () => isCoderSessionReminderEligible');
    expect(pwa).toContain('isStillEligible: () => isCoachSessionReminderEligible');
  });

  it('keeps one browser push endpoint owned by the latest signed-in account', () => {
    const push = read('src/lib/pushNotifications.ts');
    expect(push).toContain("{ onConflict: 'endpoint' }");
    expect(push).toContain('user_id: userId');
  });
});
